import anyTest, { TestInterface } from 'ava';
import { Channel } from '../src/index';

const test = anyTest as TestInterface<{
  chanA: Channel<number>;
  chanB: Channel<number>;
  messages: number[];
}>;

const msg = Math.random;

test.beforeEach('Create channels', t => {
  t.context = {
    chanA:    new Channel<number>(),
    chanB:    new Channel<number>(),
    messages: [ msg(), msg() ],
  };
});

test('Channel.alts', async t => {
  const { 
    chanA, 
    chanB,
    messages: [ valA, valB ]
  } = t.context;
  const winner = Channel.alts(chanA, chanB);
  chanB.put(valB);
  chanA.put(valA);
  const result = await winner;
  t.is(valB, result, 'should resolve to the first put\'ed value');
  t.pass();
});

test('Channel.alts as iterator', async t => {
  const {
    chanA,
    chanB,
    messages: [ valA ]
  } = t.context;
  chanA.put(valA);
  let i = 0;
  for await (const message of Channel.alts(chanA, chanB)) {
    t.is(message, valA);
    if (i === 2) {
      break;
    }
    i++;
    chanB.put(valA);
  }
  t.pass();
});

test('Channel.select', async t => {
  const {
    chanA,
    chanB,
    messages: [ valA, valB ],
  } = t.context;

  const winner = Channel.select([ chanA, chanB ]);
  chanB.put(valB);
  const result = await winner;
});
