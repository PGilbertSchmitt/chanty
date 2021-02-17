import { Channel } from './index';

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
