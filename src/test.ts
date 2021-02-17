import { Channel } from './index';

const main = async () => {
  const chanA = new Channel<number>();
  const chanB = new Channel<number>();

  const winner = Channel.select([ chanA, chanB ]);

  chanA.put(7);

  const [ n, m ] = await winner;
};

main();
