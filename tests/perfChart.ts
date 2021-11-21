import { performance } from 'perf_hooks';
import { drop, times } from 'ramda';
import { plot, Plot } from 'nodeplotlib';

import { Channel } from '../src/channel';

const NUM_RUNS = 10;
const HIGHEST_POWER = 22; // 2 ** 22 = 4194304

const runTime = async (cb: () => void) => {
  const start = performance.now();
  await cb();
  return performance.now() - start;
};

const main = async () => {
  const traces: Plot[] = [];
  for (let run = 0; run < NUM_RUNS; run++) {
    const x: number[] = [];
    const y: number[] = [];
    console.log(`Run #${run+1} of ${NUM_RUNS}`);
    const channel = new Channel<number>();
    channel.take();
    for (let power = 2; power < HIGHEST_POWER; power++) {
      const numElements = 2 ** power;
      times(() => channel.put(Math.random()), numElements / 2);
      const takeTime = await runTime(() => channel.take());
      console.log(`${takeTime}ms for ${channel.sizeMessages()} messages`);
      x.push(power);
      y.push(takeTime);
    }
    traces.push({
      x: drop(1, x),
      y: drop(1, y),
      type: 'scatter'
    });
  }
  plot(traces, {
    xaxis: {
      title: 'Power of 2 of the number of elements'
    },
    yaxis: {
      title: 'Milliseconds for take operation'
    }
  });
};

main();