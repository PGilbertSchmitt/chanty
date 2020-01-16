// Just a special type that I care about storing in any which collection object
type Spec<C> = {
  value: C;
  name: string;
}

type SpecSet<C> = Set<Spec<C>>;
type SpecArr<C> = Array<Spec<C>>;
type SpecObj<C> = { [k in string]: Spec<C> };
type SpecMap<C, K> = Map<K, Spec<C>>;

type SpecSetKeyTuple<C> = [Spec<C>, Spec<C>];
type SpecArrKeyTuple<C> = [number, Spec<C>];
type SpecObjKeyTuple<C> = [string, Spec<C>];
type SpecMapKeyTuple<C, K> = [K, Spec<C>];

type SpecCollect<C, K> = SpecSet<C> | SpecArr<C> | SpecObj<C> | SpecMap<C, K>;

type SpecTuple<T>
  = T extends SpecSet<infer C> ? SpecSetKeyTuple<C>
  : T extends SpecArr<infer C> ? SpecArrKeyTuple<C>
  : T extends SpecMap<infer C, infer K> ? SpecMapKeyTuple<C, K>
  : T extends SpecObj<infer C> ? SpecObjKeyTuple<C>
  : never;

const isSet = <C, K>(sp: SpecCollect<C, K>): sp is SpecSet<C> => {
  return (sp instanceof Set);
};

const isArr = <C, K>(sp: SpecCollect<C, K>): sp is SpecArr<C> => {
  return (sp instanceof Array);
};
  
const isMap = <C, K>(sp: SpecCollect<C, K>): sp is SpecMap<C, K> => {
  return (sp instanceof Map);
};

const fromSet = <C>(s: SpecSet<C>): SpecSetKeyTuple<C> => {
  return Array.from(s.entries())[0];
};

const fromArr = <C>(a: SpecArr<C>): SpecArrKeyTuple<C> => {
  return [ 0, a[0] ];
};

const fromMap = <C, K>(m: SpecMap<C, K>): SpecMapKeyTuple<C, K> => {
  return Array.from(m.entries())[0];
};

const fromObj = <C>(o: SpecObj<C>) => {
  return [ 'key', o['key'] ];
};

const fromCollection = <T extends SpecCollect<C, K>, C, K>(collect: T) => {
  let tup: unknown;

  if (isSet(collect)) {
    tup = fromSet(collect);
  } else if (isArr(collect)) {
    tup = fromArr(collect);
  } else if (isMap(collect)) {
    tup = fromMap(collect);
  } else {
    tup = fromObj(collect as SpecObj<C>);
  }

  return tup as SpecTuple<T>;

  // return (
  //   isSet(collect) ? fromSet(collect) : fromArr(collect as Array<Spec<C>>)
  // ) as SpecTuple<T>;
};

const set: SpecSet<number> = new Set();
const [ a, b ] = fromCollection(set);
console.log(a, b);

const ar: SpecArr<number> = new Array();
const [ c, d ] = fromCollection(ar);
console.log(c, d);

const map: Map<string, Spec<number>> = new Map();
const [ e, f ] = fromCollection(map);
console.log(e, f);

const obj: SpecObj<Spec<string>> = {};
const [ g, h ] = fromCollection(obj);
console.log(g, h);
