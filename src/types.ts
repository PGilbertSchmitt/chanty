import { MapQueue } from './mapQueue';

type Message<T> = {
  message: T,
  resolvePutter: () => void
}
type Taker<T> = (message: T) => void;

export type MapFunction<K, V, R> = (k: K, v: V) => R;
export type MessageQueue<T> = MapQueue<symbol, Message<T>>;
export type TakerQueue<T> = MapQueue<symbol, Taker<T>>;

export type CancelablePromise<T> = Promise<T> & { cancel: () => boolean };