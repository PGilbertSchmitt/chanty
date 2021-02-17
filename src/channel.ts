// import { Selectable, KeyChannelTuple, ChannelMap, ChannelSet } from './selectable';

const messages = Symbol('messages');
const putters = Symbol('putters');
const takers = Symbol('takers');
const racers = Symbol('racers');

export type IterablePromise<T> =
  & Promise<T>
  & { [Symbol.asyncIterator]: () => AsyncIterableIterator<T> };

/*******************/
/* CONTAINER TYPES */
/*******************/

/**
 * A Set of Channel objects
 */
export type ChannelSet<V> = Set<Channel<V>>;

/**
 * An Array of Channel objects
 */
export type ChannelArray<V> = Array<Channel<V>>;

export const _forEach = <V, K>(
  collection: Selectable<V, K>,
  fn: (chan: Channel<V>) => void
) => {
  if (typeof collection.forEach === 'function') {
    collection.forEach(fn);
  }
};

/**
 * A Map of any arbitrary keys to Channel objects
 */
export type ChannelMap<K, V> = Map<K, Channel<V>>;

/**
 * A struct containing Channel object values
 */
export type ChannelStruct<V> = { [k: string]: Channel<V> };

/**
 * A collection of Channels, which can either be a Set, Array, string-keyed Struct,
 * or arbitrarily-keyed Map
 */
export type Selectable<V, K>
  = ChannelSet<V>
  | ChannelArray<V>
  | ChannelMap<K, V>
  | ChannelStruct<V>;

/***************/
/* TUPLE TYPES */
/***************/

/**
 * A Channel object stored in a set and the first message from that Channel
 */
export type KeyChannelSetTuple<V> = [Channel<V>, V];

/**
 * An index into a ChannelArray and the first message from that Channel at that index
 */
export type KeyChannelArrayTuple<V> = [number, V];

/**
 * A key into a Map and the first message from the Channel stored at that key
 */
export type KeyChannelMapTuple<K, V> = [K, V];

/**
 * A key into a struct and the first message from the Channel stored at that key
 */
export type KeyChannelStructTuple<V> = [string, V];

/**
 * This confusing type allows the select method to accurately return the correct
 * tuple with the correct type information, based on the type of the input
 */
export type KeyChannelTuple<C>
  = C extends ChannelSet<infer V> ? KeyChannelSetTuple<V>
  : C extends ChannelArray<infer V> ? KeyChannelArrayTuple<V>
  : C extends ChannelMap<infer K, infer V> ? KeyChannelMapTuple<K, V>
  : C extends ChannelStruct<infer V> ? KeyChannelStructTuple<V>
  : never;

// export type SelectableTuple<V, K> = KeyChannelTuple<Selectable<V, K>>;


export class Channel<T> {
  private [messages]: T[];
  private [putters]: Array<() => void>;
  private [takers]: Array<(msg: T) => void>;
  private [racers]: Array<(chan: Channel<T>) => void>;

  public [Symbol.asyncIterator]: () => AsyncIterableIterator<T>;

  constructor() {
    this[messages] = [];
    this[putters] = [];
    this[takers] = [];
    this[racers] = [];

    const self = this;
    this[Symbol.asyncIterator] = async function* () {
      while (true) {
        yield await self._take();
      }
    };
  }

  /**
   * Enqueues a new message into the queue, returning a promise which resolves once
   * the enqueued message has been taken out.
   */
  public put = async (msg: T): Promise<void> => {
    return new Promise(resolve => {
      this[messages].unshift(msg);
      this[putters].unshift(resolve);
      if (this[takers].length) {
        // Using assertion safely since both queues will have elements
        this[putters].pop()!();
        this[takers].pop()!(this[messages].pop()!);
      }
      if (this[racers].length) {
        // Using assertion safely since both queues will have elements
        this[racers].pop()!(this);
      }
    });
  }

  /**
   * Takes the first message out of the message queue, or the next message to populate
   * the queue if it's currently empty. The returned promise resolves to the message
   * value, and also behaves as an asynchronous iterable, which continuously pops off
   * the message queue.
   */
  public take = (): IterablePromise<T> => {
    const promise = this._take();
    const ctx = this;
    const iterator = async function* (): AsyncIterableIterator<T> {
      yield await promise;
      while (true) {
        yield await ctx._take();
      }
    };
    return Object.assign(promise, {
      [Symbol.asyncIterator]: iterator
    });
  }

  /**
   * Pops all messages currently in the message queue, returning a promise that resolves
   * to an array of all values.
   */
  public drain = async (): Promise<T[]> => {
    const msgList: Promise<T>[] = [];
    while (this[messages].length) {
      msgList.push(this._take());
    }
    return Promise.all(msgList);
  }

  /**
   * Races a take from all passed channels, returning the first to resolve. The rest are
   * canceled. The returned promise also acts as an asynchronous iterator, continuously
   * evaluating the first message sent to any channel
   */
  public static alts = <T>(...chans: Channel<T>[]): IterablePromise<T> => {
    const winningPromise = Channel._alts(...chans);
    const iterator = async function* (): AsyncIterableIterator<T> {
      yield await winningPromise;
      while (true) {
        yield await Channel._alts(...chans);
      }
    };
    return Object.assign(winningPromise, {
      [Symbol.asyncIterator]: iterator
    });
  }

  public static select = <T, K>(
    chans: Selectable<T, K>
  ): IterablePromise<> => {
    const winningPromise = Channel._select(chans);
    const iterator = async function* (): AsyncIterableIterator<[unknown, T]> {
      yield await winningPromise;
      while (true) {
        yield await Channel._select(chans);
      }
    };
    return Object.assign(winningPromise, {
      [Symbol.asyncIterator]: iterator
    });
  }

  private _take = async (): Promise<T> => {
    return new Promise(resolve => {
      this[takers].unshift(resolve);
      if (this[putters].length) {
        // Using assertion safely since all these queues will have elements
        this[putters].pop()!();
        this[takers].pop()!(this[messages].pop()!);
      }
    });
  }

  private static _race = <T>(chan: Channel<T>): Promise<Channel<T>> => {
    return new Promise(resolve => {
      chan[racers].unshift(resolve);
      if (chan[putters].length) {
        chan[racers].pop()!(chan);
      }
    });
  }

  private static _alts = async <T>(...chans: Channel<T>[]): Promise<T> => {
    const winner = await Promise.race(chans.map(chan => Channel._race(chan)));
    // Flush all other racers
    chans.forEach(chan => chan !== winner && chan[racers].pop());
    // The winning channel is guaranteed to have a putter and a message,
    // since that's how it resolves in the first place
    // Now we resolve that putter and return the message 
    winner[putters].pop()!();
    return winner[messages].pop()!;
  }

  private static _select = async <C extends Selectable<V, K>, V, K>(chans: C): Promise<KeyChannelTuple<C>> => {
    const cb = async (key: K | string | number, chan: Channel<V>) => {
      const curChan = await Channel._race(chan);
      return [ key, curChan ] as KeyChannelTuple<C>;
    };
    const [ key, winner ] = await Promise.race(Channel._map(chans, cb)) as KeyChannelTuple<C>;
    Channel._foreach(chans, chan => chan !== winner && chan[racers].pop());
    // The winning channel is guaranteed to have a putter and a message,
    // since that's how it resolves in the first place
    // Now we resolve that putter and return the message
    winner[putters].pop()!();
    return [ key, winner[messages].pop()! ];
  }

  private static _map = <C extends Selectable<V, K>, V, K>(
    sel: C,
    fn: (key: K | string | number, chan: Channel<V>) => Promise<KeyChannelTuple<C>>
  ) => {
    if (sel instanceof Set) {
      return [ ...sel.values() ].map(ch => fn(ch, ch));
    } else if (sel instanceof Map) {
      return [ ...sel.entries() ].map(([ key, ch ]) => fn(key, ch));
    } else if (Array.isArray(sel)) {
      return sel.map((ch, key) => fn(key, ch));
    } else {
      return Object.entries(sel).map(([ key, ch ]) => fn(key, ch));
    }
  }

  // private static _foreach = <V, K>(
  //   sel: Selectable<V, K>,
  //   fn: (chan: Channel<V>) => void
  // ) => {
  //   if (sel instanceof Map) {
  //     sel.forEach(fn);
  //   } else {
  //     Object.values(sel).forEach(fn);
  //   }
  // }


  private static _foreach = <V, K>(
    sel: Selectable<V, K>,
    fn: (chan: Channel<V>) => void
  ) => {
    if (typeof sel.forEach === 'function') {
      sel.forEach(fn);
    } else {
      Object.values(sel).forEach(fn);
    }
  }
}
