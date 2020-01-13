const messages = Symbol('messages');
const putters = Symbol('putters');
const takers = Symbol('takers');
const racers = Symbol('racers');

export type IterablePromise<T> =
  & Promise<T>
  & { [Symbol.asyncIterator]: () => AsyncIterableIterator<T> };

export type Selectable<T> =
  | Set<Channel<T>>
  | Map<unknown, Channel<T>>
  | Array<Channel<T>>
  | { [k: string]: Channel<T> };

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

  private static _race = <T>(chan: Channel<T>): Promise<Channel<T>> => {
    return new Promise(resolve => {
      chan[racers].unshift(resolve);
      if (chan[putters].length) {
        chan[racers].pop()!(chan);
      }
    });
  }
}
