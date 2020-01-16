// Just a special type that I care about storing in any which collection object
type Spec = {
  value: number;
  name: string;
}

type SpecSet = Set<Spec>;
type SpecArr = Array<Spec>;
type SpecObj = { [k in string]: Spec };
type SpecMap<K> = Map<K, Spec>;

type SpecSetKeyTuple = [Spec, Spec];
type SpecArrKeyTuple = [number, Spec];
type SpecObjKeyTuple = [string, Spec];
type SpecMapKeyTuple<K> = [K, Spec];

type SpecCollect<K> = SpecSet | SpecArr | SpecObj | SpecMap<K>;

type SpecTuple<T> = T extends SpecSet ? SpecSetKeyTuple
                  : T extends SpecArr ? SpecArrKeyTuple
                  : T extends SpecMap<infer K> ? SpecMapKeyTuple<K>
                  : T extends SpecObj ? SpecObjKeyTuple
                  : never;

const isSet = <K>(sp: SpecCollect<K>): sp is SpecSet => {
  return (sp instanceof Set);
};

const isArr = <K>(sp: SpecCollect<K>): sp is SpecArr => {
  return (sp instanceof Array);
};

const isMap = <K>(sp: SpecCollect<K>): sp is SpecMap<K> => {
  return (sp instanceof Map);
};

const fromMap = <K>(map: SpecMap<K>): SpecMapKeyTuple<K> => {
  return Array.from(map.entries())[0];
};

const fromSet = (set: SpecSet): SpecSetKeyTuple => {
  return Array.from(set.entries())[0];
};

const fromArr = (arr: SpecArr): SpecArrKeyTuple => {
  return [ 0, arr[0] ];
};

const fromObj = (obj: SpecObj): SpecObjKeyTuple => {
  return [ 'index', obj['index'] ];
};

const fromCollection = <T extends SpecCollect<K>, K>(collect: T): SpecTuple<T> => {
  let tup: unknown;
  
  if (isSet(collect)) {
    tup = fromSet(collect);
  } else if (isMap(collect)) {
    tup = fromMap((collect as SpecMap<K>));
  } else if (isArr(collect)) {
    tup = fromArr(collect);
  } else {
    tup = fromObj(collect as SpecObj);
  }
  
  return tup as SpecTuple<T>;
};

const m: Map<number, Spec> = new Map();
const [ m_number, m_spec ] = fromCollection(m);

const s: Set<Spec> = new Set();
const [ s_spec, s_spec_2 ] = fromCollection(s);

const a: Array<Spec> = new Array();
const [ a_number, a_spec ] = fromCollection(a);

const o: { [x: string]: Spec } = {};
const [ o_string, o_spec ] = fromCollection(o);

console.log(m_number, m_spec, s_spec, s_spec_2, a_number, a_spec, o_string, o_spec);

export {};
