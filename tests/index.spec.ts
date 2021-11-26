import test from 'ava';
import { times } from "ramda";
import { Channel } from '../src/channel';

const msg = Math.random;

const initializeChannels = (number = 1) => times(() => new Channel<number>(), number);

test('Channel constructor', t => {
  const [chan] = initializeChannels();
  t.true(chan instanceof Channel, 'should create Channel object');
});

test('Channel#put', t => {
  const [chan] = initializeChannels();
  const promise = chan.put(msg());
  t.log(`Value is ${promise}`);
  t.true(promise instanceof Promise, 'should return a promise when there are no takers/racers');
});

test('Channel#take', t => {
  const [chan] = initializeChannels();
  const promise = chan.take();
  t.true(promise instanceof Promise, 'should return a promise');
});

test('Channel#take after #put', async t => {
  const [chan] = initializeChannels();
  const val = msg();
  chan.put(val);
  const taken = await chan.take();
  t.is(taken, val, 'should resolve to the put\'ed value');
});

test('Channel#put after take', async t => {
  const [chan] = initializeChannels();
  const takenPromise = chan.take();
  const val = msg();
  chan.put(val);
  const taken = await takenPromise;
  t.is(taken, val, 'should resolve to the put\'ed value');
});

test('Channel#drain', async t => {
  const [chan] = initializeChannels();
  const messages = [msg(), msg(), msg()];
  messages.map(m => chan.put(m));
  const result = chan.drain();
  t.deepEqual(result, messages, 'should resolve to all put\'ed values in the correct order');
});

test('Channel#drain on empty channel', async t => {
  const [chan] = initializeChannels();
  const result = chan.drain();
  t.deepEqual(result, [], 'should resolve to an empty array');
});

test('Channel#drain after queued take', async t => {
  const [chan] = initializeChannels();
  chan.take();
  const result = chan.drain();
  t.is(result, null, 'should resolve to null');
});

test('Channel#messages as async iterator', async t => {
  const [chan] = initializeChannels();
  const messages = [msg(), msg(), msg()];
  messages.map(m => chan.put(m));
  let i = 0;
  for await (const message of chan.messages()) {
    t.is(message, messages[i], 'should resolve to put\'ed value in the correct order');
    i++;
    if (i === 3) { break; }
  }
});

test('Channel.race as promise', async t => {
  const [chanA, chanB] = initializeChannels(2);
  const promise = Channel.race([chanA, chanB]);
  t.true(promise instanceof Promise, 'should return a promise');
});

test('Channel.race after #put', async t => {
  const [chanA, chanB] = initializeChannels(2);
  const promise = Channel.race([chanA, chanB]);
  const val = msg();
  await chanB.put(val);
  const message = await promise;
  t.is(message, val, 'should resolve to the first put\'ed value');
});

test('Channel.race before #put', async t => {
  const [chanA, chanB] = initializeChannels(2);
  const [valA, valB] = [msg(), msg()];
  chanA.put(valA);
  chanB.put(valB);
  const messageA = await Channel.race([chanA, chanB]);
  const messageB = await Channel.race([chanA, chanB]);
  t.is(messageA, valA, 'should resolve to the first put\'ed value');
  t.is(messageB, valB, 'should resolve to the second put\'ed value');
});

test('Channel.race between #put calls', async t => {
  const [chanA, chanB] = initializeChannels(2);
  const [valA, valB] = [msg(), msg()];
  chanA.put(valA);
  const messageA = await Channel.race([chanA, chanB]);
  const messageBPromise = Channel.race([chanA, chanB]);
  await chanB.put(valB);
  const messageB = await messageBPromise;
  t.is(messageA, valA, 'should resolve to the first put\'ed value');
  t.is(messageB, valB, 'should resolve to the second put\'ed value');
});

test('Channel.select after #put', async t => {
  const [chanA, chanB] = initializeChannels(2);
  const [keyA, keyB, valA, valB] = times(msg, 4);
  const map = new Map();
  map.set(keyA, chanA);
  map.set(keyB, chanB);

  chanA.put(valA);
  chanA.put(valB);
  const [ message, key ] = await Channel.select(map);

  t.is(message, valA, 'should resolve to the first put\'ed value');
  t.is(key, keyA, 'should resolve to the key of the put\'ed channel in the map');
});

test('Channel.select before #put', async t => {
  const [chanA, chanB] = initializeChannels(2);
  const [keyA, keyB, valA, valB] = times(msg, 4);
  const map = new Map();
  map.set(keyA, chanA);
  map.set(keyB, chanB);
  
  const resultPromise = Channel.select(map);
  chanA.put(valA);
  chanA.put(valB);
  const [ message, key ] = await resultPromise;

  t.is(message, valA, 'should resolve to the first put\'ed value');
  t.is(key, keyA, 'should resolve to the key of the put\'ed channel in the map');
});

test('Channel.select between #put calls', async t => {
  const [chanA, chanB] = initializeChannels(2);
  const [keyA, keyB, valA, valB] = times(msg, 4);
  const map = new Map();
  map.set(keyA, chanA);
  map.set(keyB, chanB);

  chanB.put(valB);
  const resultPromise = Channel.select(map);
  chanB.put(valA);

  const [ message, key ] = await resultPromise;
  t.is(message, valB, 'should resolve to the first put\'ed value');
  t.is(key, keyB, 'should resolve to the key of the put\'ed channel in the map');
});

test('Channel#sizeMessages', async t => {
  const [chan] = initializeChannels();
  times(() => chan.put(msg()), 5);
  await Promise.all([
    chan.take(),
    chan.take()
  ]);

  t.is(chan.sizeMessages(), 3, 'should return the correct size of the message queue');
});

test('Channel#sizeTakers', async t => {
  const [chan] = initializeChannels();
  times(() => chan.take(), 5);
  await Promise.all([
    chan.put(msg()),
    chan.put(msg()),
    chan.put(msg())
  ]);

  t.is(chan.sizeTakers(), 2, 'should return the correct size of the message queue');
});

test('Channel#putWithCancel when canceling before take', async t => {
  const [chan] = initializeChannels();
  const [msgA, msgB, msgC] = times(msg, 3);

  chan.put(msgA);
  const [ _, cancel] = chan.putWithCancel(msgB);
  chan.put(msgC);
  
  const wasCanceled = cancel();

  const valA = await chan.take();
  const valC = await chan.take();

  t.is(valA, msgA, 'should equal the first put\'ed message');
  t.is(valC, msgC, 'should equal the third put\'ed message');
  t.true(wasCanceled, 'should return true if the `put` was canceled');
});

test('Channel#putWithCancel when canceling after take', async t => {
  const [chan] = initializeChannels();
  const [msgA, msgB, msgC] = times(msg, 3);

  chan.put(msgA);
  const [ _, cancel] = chan.putWithCancel(msgB);
  chan.put(msgC);

  const valA = await chan.take();
  const valB = await chan.take();
  const valC = await chan.take();

  const wasCanceled = cancel();

  t.is(valA, msgA, 'should equal the first put\'ed message');
  t.is(valB, msgB, 'should equal the second put\'ed message');
  t.is(valC, msgC, 'should equal the third put\'ed message');
  t.false(wasCanceled, 'should return false if the `put` was not canceled in time');
});

test('Channel#takeWithCancel when canceling before put', async t => {
  const [chan] = initializeChannels();
  const [msgA, msgB] = times(msg, 2);

  const firstTake = chan.take();
  const [secondTake, cancel] = chan.takeWithCancel();
  const thirdTake = chan.take();

  const wasCanceled = cancel();

  chan.put(msgA);
  chan.put(msgB);

  t.is(await firstTake, msgA, 'should resolve to the first message');
  t.is(await secondTake, null, 'should resolve to null');
  t.is(await thirdTake, msgB, 'should resolvto the second message');
  t.true(wasCanceled, 'should return true if the `take` was canceled');
});

test('Channel#takeWithCancel when canceling after put', async t => {
  const [chan] = initializeChannels();
  const [msgA, msgB, msgC] = times(msg, 3);

  const firstTake = chan.take();
  const [secondTake, cancel] = chan.takeWithCancel();
  const thirdTake = chan.take();
  
  chan.put(msgA);
  chan.put(msgB);
  chan.put(msgC);

  const wasCanceled = cancel();

  t.is(await firstTake, msgA, 'should resolve to the first message');
  t.is(await secondTake, msgB, 'should resolve to the second message');
  t.is(await thirdTake, msgC, 'should resolvto the third message');
  t.false(wasCanceled, 'should return false if the `take` was not canceled in time');
});
