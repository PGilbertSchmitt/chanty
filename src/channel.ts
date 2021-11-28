import { MapQueue } from './mapQueue';
import {
  MapFunction,
  MessageQueue,
  TakerQueue,
  CancelablePutPromise,
  CancelableTakePromise
} from './types';

const MESSAGES = Symbol('MESSAGES');
const TAKERS = Symbol('TAKERS');

const notEmpty = (collection: MapQueue<any, any>) => {
  return collection.size() > 0;
};

const mapOverMap = <K, V, T>(map: Map<K, V>, fn: MapFunction<K, V, T>) => {
  const results = [];
  for (let [k, v] of map.entries()) {
    results.push(fn(k, v));
  }
  return results;
};

const wrapInPromise = <T>(resolver: () => void, value: T) => {
  return new Promise<T>(r => {
    resolver();
    r(value);
  })
};

export class Channel<T> {
  private [MESSAGES]: MessageQueue<T>;
  private [TAKERS]: TakerQueue<T>;

  constructor() {
    // Message queue, expressed as objects wrapping a message and a putterResolver
    // It could just be an array, but reusing the MapQueue keeps operations at a
    // constant speed, no matter how big the queue, which comes at the cost of
    // using about 2 times more memory, but memory is cheep, especially if you're
    // the kind of person to put millions of messages in a channel before taking
    // them out.
    this[MESSAGES] = new MapQueue();
    // Taker MapQueue, accepting a symbol key. The value is a function that
    // resolves the taker.
    // Racers will handle deleting of sibling racers in this resolver function.
    this[TAKERS] = new MapQueue();
  };

  /**
   * Adds a message to the channel. Returns a promise that resolves when the message was
   * taken from the channel, such as by `take` or `drain`. If there is a queued `take`,
   * it is synchronously removed from the queue, but the resolution is still wrapped in
   * a promise for consistency.
   */
  // put = (message: T): Promise<void> => {
  //   return this._put(message);
  // };

  put = (message: T): CancelablePutPromise<void> => {
    const queueKey = Symbol('put-key');
    const promise: Promise<void> = this._put(message, queueKey);
    const cancel = () => {
      if (this[MESSAGES].has(queueKey)) {
        const { resolvePutter } = this[MESSAGES].steal(queueKey);
        resolvePutter();
        return true;
      } else {
        return false;
      }
    };
    return Object.assign(promise, { cancel });
  };

  /**
   * Returns a promise that resolves to the value of next message `put` into the channel.
   * If there is a queued message, it is synchronously removed from the queue, but the
   * resolution is still wrapped in a promise for consistency. The returned promise has
   * a `cancel` method, which can attempt to unqueue a particular `take`. If this happens,
   * the promise resolves to `null`.
   */
  take = (): CancelableTakePromise<T> => {
    const queueKey = Symbol('take-key');
    const promise = this._take(queueKey);

    const cancel = (subMessage: T) => {
      if (this[TAKERS].has(queueKey)) {
        const resolveTaker = this[TAKERS].steal(queueKey);
        resolveTaker(subMessage);
        return true;
      } else {
        return false;
      }
    };

    return Object.assign(promise, { cancel });
  };

  /**
   * Returns an array of all the values of the messages currently in the channel,
   * then resets the message queue. If there are queued takers when drain is
   * called, this resolves to null, and the existing takers are NOT resolved.
   * This method is synchronous.
   */
  drain = () => {
    return this[MESSAGES].drain().map(({ value }) => {
      value.resolvePutter();
      return value.message;
    });
  };

  /**
   * Take as an asynchronous iterator, which iterates of the messages in the queue
   * as they arrive;
   */
  messages = (): AsyncIterable<T> => {
    const self = this;
    return {
      [Symbol.asyncIterator]: async function* () {
        while (true) {
          yield await self._take(Symbol('messages-key'));
        }
      }
    }
  };

  sizeMessages = () => {
    return this[MESSAGES].size();
  };

  sizeTakers = () => {
    return this[TAKERS].size();
  };

  private _take = (queueKey: symbol): Promise<T> => {
    if (notEmpty(this[MESSAGES])) {
      const { message, resolvePutter } = this[MESSAGES].pop().value;
      return wrapInPromise(resolvePutter, message);
    }
    return new Promise(resolveTaker => {
      this[TAKERS].push(queueKey, resolveTaker);
    });
  };

  private _put = (message: T, queueKey: symbol): Promise<void> => {
    if (notEmpty(this[TAKERS])) {
      // By removing the queued taker synchronously, we should prevent any weird race
      // conditions. Wrapping the resolution of that into a new promise makes it
      // easier to reason about the datatypes, as #put should always return a promise,
      // even if it technically resolves immediately.
      const resolveTaker = this[TAKERS].pop().value;
      // return wrapInPromise(() => resolveTaker(message));
      return new Promise(r => {
        resolveTaker(message);
        r();
      });
    }
    return new Promise<void>(resolvePutter => {
      this[MESSAGES].push(queueKey, {
        message,
        resolvePutter
      });
    });
  };

  // The idea behind `cleanup` is that when a race between several channels ends,
  // there should be no chance of the sibling `takers` in the losing channels to
  // be executed. To facilitate this, `cleanup` is a function that removes the
  // other `takers` during the same synchronous flow.
  private _raceTake = (key: symbol, cleanup: () => void): Promise<T> => {
    return new Promise(resolveTaker => {
      this[TAKERS].push(key, message => {
        cleanup();
        resolveTaker(message);
      });
    });
  };

  /**
   * Returns a promise that resolves to the first message received
   * by any channel in the passed array of channels.
   */
  static race = <T>(channels: Array<Channel<T>>): Promise<T> => {
    // Before adding takers, first check if a race is necessary. If any channels have queued
    // messages at the start, `#race` will return the earlist one in the list.
    for (const channel of channels) {
      if (notEmpty(channel[MESSAGES])) {
        const { message, resolvePutter } = channel[MESSAGES].pop().value;
        return wrapInPromise(resolvePutter, message);
      }
    }

    const racerKey = Symbol('race-key');
    const racePromises = channels.map(channel => channel._raceTake(racerKey, () => {
      channels.forEach(racer => racer[TAKERS].delete(racerKey));
    }));
    return Promise.race(racePromises);
  };

  /**
   * When passed a Map of channels, returns a promise that resolves to the first message
   * received by any channel in the map, as well as the key in the map where the channel that
   * received the message was stored.
   */
  static select = async <K, T>(channelMap: Map<K, Channel<T>>): Promise<[T, K]> => {
    // Before adding takers, first check if a race is necessary. If any channels have queued
    // messages at the start, `#race` will return the earlist one in the list.
    for (const [key, channel] of channelMap.entries()) {
      if (notEmpty(channel[MESSAGES])) {
        const { message, resolvePutter } = channel[MESSAGES].pop().value;
        return wrapInPromise(resolvePutter, [message, key]);
      }
    }

    const uniqueKey = Symbol('select-key');
    return await Promise.race(
      mapOverMap(channelMap, async (key, channel) => {
        const winningMessage = await channel._raceTake(uniqueKey, () => {
          // Cleanup function
          mapOverMap(channelMap, (_key, channel) => {
            channel[TAKERS].delete(uniqueKey);
          })
        });
        return [winningMessage, key];
      })
    );
  };
};
