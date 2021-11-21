import test from 'ava';
import { times } from 'ramda';
import { MapQueue } from '../src/mapQueue';

const uniq = () => Math.random();
const initQ = <T = number>() => new MapQueue<number, T>();

test('MapQueue constructor', t => {
  const mq = initQ();
  t.true(mq instanceof MapQueue, 'should create MapQueue object');
});

test('MapQueue#size', t => {
  const mq = initQ();
  t.is(mq.size(), 0, 'should have an initial size of 0');

  mq.push(uniq(), uniq());
  mq.push(uniq(), uniq());
  mq.push(uniq(), uniq());

  t.is(mq.size(), 3, 'should grow by one with every push');

  mq.pop();

  t.is(mq.size(), 2, 'should shrink by one with every pop');
});

test('MapQueue#pop', t => {
  const mq = initQ();
  const [keyA, keyB, msgA, msgB] = [uniq(), uniq(), uniq(), uniq()];
  mq.push(keyA, msgA);
  mq.push(keyB, msgB);

  t.deepEqual(
    mq.pop(),
    { key: keyA, value: msgA },
    'should equal the key and value of the first pushed key and value'
  );
  t.deepEqual(
    mq.pop(),
    { key: keyB, value: msgB },
    'should equal the key and value of the second pushed key and value'
  );
});

test('MapQueue#pop when empty', t => {
  const mq = initQ();
  const error = t.throws(() => {
    mq.pop();
  }, null, 'should throw an error');
  t.is(
    error.message,
    'Nothing to pop, check size before popping',
    'should give the correct error message'
  );
});

test('MapQueue#push when pushing an undefined value', t => {
  const mq = initQ<undefined>();
  const error = t.throws(() => {
    // Based on the fact that I'm using a non-null assertion on the `undefined` literal,
    // you know I'm testing edge cases. All about that 100% coverage, baby!
    mq.push(uniq(), undefined!);
  });
  t.is(
    error.message,
    'Value was null or undefined',
    'should give the correct error message'
  );
});

test('MapQueue#push when pushing a null value', t => {
  const mq = initQ<null>();
  const error = t.throws(() => {
    // Based on the fact that I'm using a non-null assertion on the `null` literal,
    // you know I'm testing edge cases. All about that 100% coverage, baby!
    mq.push(uniq(), null!);
  });
  t.is(
    error.message,
    'Value was null or undefined',
    'should give the correct error message'
  );
});

test('MapQueue#push with duplicate key', t => {
  const mq = initQ();
  const sameKey = uniq();
  mq.push(sameKey, uniq());
  const error = t.throws(() => {
    mq.push(sameKey, uniq());
  });
  t.is(
    error.message,
    'Duplicate key in MapQueue, not designed for re-queueing keys',
    'should give the correct error message'
  );
});

test('MapQueue#push with duplicate key after original is popped', t => {
  const mq = initQ();
  const sameKey = uniq();
  mq.push(sameKey, uniq());
  mq.pop();
  t.notThrows(() => {
    mq.push(sameKey, uniq());
  }, 'does not throw');
  t.pass();
});

test('MapQueue#push with duplicate key after original is deleted', t => {
  const mq = initQ();
  const sameKey = uniq();
  mq.push(sameKey, uniq());
  mq.delete(sameKey);
  t.notThrows(() => {
    mq.push(sameKey, uniq());
  }, 'does not throw');
});

test('MapQueue#delete', t => {
  const mq = initQ();

  const [keyA, keyB, keyC, msgA, msgB, msgC] = times(uniq, 6);

  mq.push(keyA, msgA);
  mq.push(keyB, msgB);
  mq.push(keyC, msgC);

  t.is(mq.size(), 3, 'should start with size three');
  mq.delete(keyB);
  t.is(mq.size(), 2, 'should now have size 2');

  t.deepEqual(
    mq.pop(),
    { key: keyA, value: msgA },
    'should equal the key and value of the first pushed key and value'
  );
  t.deepEqual(
    mq.pop(),
    { key: keyC, value: msgC },
    'should equal the key and value of the third pushed key and value'
  );

  t.is(mq.size(), 0, 'should now be empty');
});

test('MapQueue#delete when key doesn\'t exist', t => {
  const mq = initQ();
  t.notThrows(() => {
    mq.delete(uniq());
  }, 'does not throw');
});

test('MapQueue#has', t => {
  const mq = initQ();
  const key = uniq();
  mq.push(key, uniq());
  t.true(mq.has(key), 'returns true if the map has the key');
  t.false(mq.has(uniq()), 'returns false if the map doesn\'t have the key');
});

test('MapQueue#has after key is popped', t => {
  const mq = initQ();
  const key = uniq();
  mq.push(key, uniq());
  mq.pop();
  t.false(mq.has(key), 'does not have the key');
});

test('MapQueue#has after key is deleted', t => {
  const mq = initQ();
  const key = uniq();
  mq.push(key, uniq());
  mq.delete(key);
  t.false(mq.has(key), 'does not have the key');
});

test('MapQueue#drain', t => {
  const mq = initQ();
  const [keyA, keyB, msgA, msgB] = times(uniq, 4);

  mq.push(keyA, msgA);
  mq.push(keyB, msgB);

  t.deepEqual(
    mq.drain(),
    [{ key: keyA, value: msgA }, { key: keyB, value: msgB }],
    'returns the pushed key/value pairs in order'
  );
});

test('MapQueue#drain when queue is empty', t => {
  const mq = initQ();
  t.deepEqual(mq.drain(), [], 'returns an empty array');
});

test('MapQueue#drain after a pop', t => {
  const mq = initQ();
  const [keyA, keyB, keyC, msgA, msgB, msgC] = times(uniq, 6);

  mq.push(keyA, msgA);
  mq.push(keyB, msgB);
  mq.push(keyC, msgC);

  mq.pop();

  t.deepEqual(
    mq.drain(),
    [{ key: keyB, value: msgB }, { key: keyC, value: msgC }],
    'returns the pushed key/value pairs in order'
  );
});

test('MapQueue#drain after a delete', t => {
  const mq = initQ();
  const [keyA, keyB, keyC, msgA, msgB, msgC] = times(uniq, 6);

  mq.push(keyA, msgA);
  mq.push(keyB, msgB);
  mq.push(keyC, msgC);

  mq.delete(keyB);

  t.deepEqual(
    mq.drain(),
    [{ key: keyA, value: msgA }, { key: keyC, value: msgC }],
    'returns the pushed key/value pairs in order'
  );
});
