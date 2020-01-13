import anyTest, { TestInterface } from 'ava';
import { Channel } from '../src/index';

const test = anyTest as TestInterface<{
  chan: Channel<number>;
}>;

const msg = Math.random;

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

test('Channel#drain', async t => {
  const chan = t.context.chan;
  const messages = [ msg(), msg(), msg() ];
  messages.map(m => chan.put(m));
  const result = await chan.drain();
  t.deepEqual(result, messages, 'should resolve to all put\'ed values in the correct order');
  t.pass();
});

test('Channel as iterator', async t => {
  const chan = t.context.chan;
  const messages = [ msg(), msg(), msg() ];
  messages.map(m => chan.put(m));
  let i = 0;
  for await (const message of chan) {
    t.is(message, messages[i], 'should resolve to put\'ed value in the correct order');
    i++;
    if (i === 3) { break; }
  }
  t.pass();
});

test('Channel#take as iterator', async t => {
  const chan = t.context.chan;
  const messages = [ msg(), msg(), msg() ];
  messages.map(m => chan.put(m));
  let i = 0;
  for await (const message of chan.take()) {
    t.is(message, messages[i], 'should resolve to put\'ed value in the correct order');
    i++;
    if (i === 3) { break; }
  }
  t.pass();
});
