import anyTest, { TestInterface } from 'ava';
import { Channel } from '../src/index';

const test = anyTest as TestInterface<{
  chan: Channel<number>;
}>;

const msg = () => Math.random();

test.beforeEach('Create channel', t => {
  t.context = { chan: new Channel() };
});

test('Channel constructor', t => {
  const chan = t.context.chan;
  t.true(chan instanceof Channel, 'should create Channel object');
  t.pass();
});

test('Channel#put', t => {
  const chan = t.context.chan;
  const promise = chan.put(msg());
  t.true(promise instanceof Promise, 'should return a promise');
  t.pass();
});

test('Channel#take', t => {
  const chan = t.context.chan;
  const promise = chan.take();
  t.true(promise instanceof Promise, 'should return a promise');
});

test('Channel#take after #put', async t => {
  const chan = t.context.chan;
  const val = msg();
  chan.put(val);
  const taken = await chan.take();
  t.is(taken, val, 'should resolve to the put\'ed value');
  t.pass();
});

test('Channel#put after take', async t => {
  const chan = t.context.chan;
  const takenPromise = chan.take();
  const val = msg();
  chan.put(val);
  const taken = await takenPromise;
  t.is(taken, val, 'should resolve to the put\'ed value');
  t.pass();
});
