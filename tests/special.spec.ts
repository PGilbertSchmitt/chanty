import test from 'ava';
import { times } from "ramda";
import { Channel } from '../src/channel';

const msg = Math.random;

const initializeChannels = (number = 1) => times(() => new Channel<number>(), number);

/**
 * This file is for testing some special cases for expected behavior. I keep them
 * seperate from the tests in `index.spec.js` because that's for the main elements
 * of behavior.
 */

test('Channel.race when different channel has a queued taker', async t => {
  const [chanA, chanB, chanC] = initializeChannels(3);
  const [msgA, msgB] = times(msg, 2);

  const takePromise = chanA.take();
  const racePromise = Channel.race([chanA, chanB, chanC]);
  await chanA.put(msgA);
  await chanB.put(msgB);

  t.is(await takePromise, msgA, 'should equal the first put message');
  t.is(await racePromise, msgB, 'should equal the second put message');
});

test('Channel.race when same channel has a queued taker', async t => {
  const [chanA, chanB, chanC] = initializeChannels(3);
  const [msgA, msgB] = times(msg, 2);

  const takePromise = chanA.take();
  const racePromise = Channel.race([chanA, chanB, chanC]);
  await chanA.put(msgA);
  await chanA.put(msgB);

  t.is(await takePromise, msgA, 'should equal the first put message');
  t.is(await racePromise, msgB, 'should equal the second put message');
});