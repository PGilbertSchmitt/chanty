// CSP Plus

const messages = Symbol('messages');
const putters = Symbol('putters');
const takers = Symbol('takers');

export type IterablePromise<T> =
  & Promise<T>
  & { [Symbol.asyncIterator]: () => AsyncIterableIterator<T> };

export class Channel<T> {
  private [messages]: T[];
  private [putters]: Array<() => void>;
  private [takers]: Array<(msg: T) => void>;
  public [Symbol.asyncIterator]: () => AsyncIterableIterator<T>;

  constructor() {
    this[messages] = [];
    this[putters] = [];
    this[takers] = [];

    const self = this;
    this[Symbol.asyncIterator] = async function* () {
      while (true) {
        yield await self._take();
      }
    };
  }

  public put = async (msg: T): Promise<void> => {
    return new Promise(resolve => {
      this[messages].unshift(msg);
      this[putters].unshift(resolve);
      if (this[putters].length && this[takers].length) {
        // Using assertion safely since both queues will have elements
        this[putters].pop()!();
        this[takers].pop()!(this[messages].pop()!);
      }
    });
  }

  public take = (): IterablePromise<T> => {
    const promise = this._take();
    const self = this;
    const iterator = async function* (): AsyncIterableIterator<T> {
      yield await promise;
      while (true) {
        yield await self._take();
      }
    };
    return Object.assign(promise, {
      [Symbol.asyncIterator]: iterator
    });
  }

  private _take = async (): Promise<T> => {
    return new Promise(resolve => {
      this[takers].unshift(resolve);
      if (this[putters].length && this[takers].length) {
        // Using assertion safely since both queues will have elements
        this[putters].pop()!();
        this[takers].pop()!(this[messages].pop()!);
      }
    });
  }
}
