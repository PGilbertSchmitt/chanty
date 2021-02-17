import { Channel } from './channel';
import { ChannelArray } from './selectable';

// type ChannelArray<V> = Array<Channel<V>>;

export const forEach = <V>(
  coll: ChannelArray<V>,
  fn: (ch: Channel<V>) => void
) => {
  coll.forEach(fn);
};
