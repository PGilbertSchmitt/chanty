interface KVPair<K, V> {
  key: K,
  value: V
}

/**
 * JS maps store their key-value pairs in insertion order already. MapQueue is just a
 * slightly more convenient way to work with a Map in a Queue-like fashion.
 * 
 * Probably.
 * 
 * Who cares?
 * 
 * (I do)
 */
export class MapQueue<K, V> {
  private _map: Map<K, NonNullable<V>>;
  constructor() {
    this._map = new Map();
  }

  size = () => this._map.size;

  push = (key: K, value: NonNullable<V>) => {
    if (value === undefined || value === null) {
      throw new Error('Value was null or undefined')
    }
    if (this._map.has(key)) {
      throw new Error('Duplicate key in MapQueue, not designed for re-queueing keys');
    }
    this._map.set(key, value);
  };

  pop = (): KVPair<K, V> => {
    const key = this._headKey();
    if (key === null) {
      throw new Error('Nothing to pop, check size before popping');
    }
    const value = this._map.get(key);
    if (value === undefined || value === null) {
      throw new Error('Value was null or undefined')
    }
    this._map.delete(key);
    return { key, value };
  };

  delete = (key: K) => {
    this._map.delete(key);
  };

  has = (key: K) => {
    return this._map.has(key);
  };

  drain = () => {
    const values = Array.from(this._map.values());
    this._map.clear();
    return values;
  }

  _headKey = () => {
    const { value, done } = this._map.keys().next();
    return done ? null : (value as K);
  }
};
