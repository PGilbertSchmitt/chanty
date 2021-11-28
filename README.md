# tiny-csp
A small, feature-packed, well tested CSP (Communication Sequential Processes) written in TypeScript, based originally [f5io's csp library](https://github.com/f5io/csp)

## Motivation

There are already several CSP libraries out there. However, I've run into my own issues while working with them, and I can't find one that provides all the the following:

* Well typed
* Introspection on channels
* Safe against race conditions
* Channels as class objects with methods so I could have just one import
* Ability to cancel take/put operations
* Optimized for high number of messages/takers
* No external dependencies
* 100% test coverage

I primarily care about the first three, the rest are just nice-to-haves. `tiny-csp` satisfies all of the above.

## How to use:

```JS
import { Channel } from 'tiny-csp';

const channel = new Channel();
channel.put({
  foo: 'hello world',
  num: 418
});

channel.take().then(({ foo, num }) => {
  //...
});

```

### Queue Behavior
The channel behaves as a queue, meaning messages are removed from the channel in the same order that they are added. In order to push messages in to the channel, there's the [`put`](#put) method.

### Receiving Messages
There are several ways of receiving messages from the channel:
- [`take`](#take) method - Simple complement to `put`, which removes the oldest message from the channel.
- [`messages`](#messages) method - An iterator for `take`
- [`drain`](#drain) method - Pulls all existing messages from the channel.
- [`Channel.race`](#race) static method - For an array of channels, returns the first message passed into any of them.
- [`Channel.select`](#select) static method - For a map of channels, returns the first message passed into any of them, as well as the key in the map to which the winning channel belongs.

### Cancelable `put` and `take` Promises
There is an exception to the queue behavior in that the `put` and `take` methods both return a [cancelable promise](#important-type-definitions). By calling the `cancel` method before the message is removed/passed by normal means, the message/taker will be forcefully removed from the queue, regardless of its position.

# Design

Internally, this is all handled by 2 queues: the message queue and the taker queue. Let's forget about all the above and focus on `put` and `take`.

1. If the message queue is empty when calling `take`, a _taker_ is pushed into the taker queue.
2. If the message queue is not empty when calling `take`, the oldest message is popped from the message queue synchronously, and returned as a promise which resolves immediately.
3. If the taker queue is empty when calling `put`, a message is pushed into the message queue.
4. If the taker queue is not empty when calling `put`, the oldest taker is popped from the taker queue synchronously and is resolved with the message passed to `put`.

Because of steps (2) and (4), there will never be a situation where both the message queue and the taker queue have elements. One will always be empty, and any attempts to fill the singular empty queue is resolved synchronously before the result is wrapped in a promise. This should protect a channel from race conditions.

The static methods `race` and `select` also add to the taker queue when the message queue is empty, or resolve immediately if any of the channels contain queued messages.

`drain` does not use the taker queue since it's a synchronous method only designed at emptying the message queue at the moment `drain` is called.

# Important Type Definitions

## CancelablePutPromise
`CancelablePutPromise<T>`

This type is returned by the `put` method, which allows it to eventually resolve while allowing the caller to cancel the `put` action if needed.

Defined as `Promise<T> & { cancel: () => boolean }`, which is to say it's a Promise, but also has a cancel method which returns a boolean that answers the question: _"Was the `put` canceled in time?"_. A `false` means that the promise was already resolved when `cancel` was called, and the message was removed by a `take`/`race`/`select`/`drain`.

## CancelableTakePromise
`CancelableTakePromise<T>`

This type is returned by the `take` method, which allows it to eventually resolve to a value while allowing the caller to cancel the `take` action if needed.

Defined as `Promise<T> & { cancel: (message: T) => boolean }`, which like `CancelablePutPromise` is a promise with a `cancel` method. This `cancel` method is identical to the above, with the difference being that it expects a substitute message to be passed to the canceled taker. This resolves the promise into the substitute string.

# Public Methods

** _For TypeScript, `T` in the type definitions below refers to the same type argument passed to the constructor. You will find it in the return types for the channel methods._

## Constructor
`Channel<T>()`

Instantiate a new channel. In TypeScript, the constructor expects a type param that defines the message type.

```TS
// JavaScript
const channel = new Channel();

// TypeScript
const channel = new Channel<string>();
```

---

## put
`(message: T) => CancelablePromise<void>`

Push a message into the channel. Returns a promise that resolves when the message has been removed from the channel. This promise will also contain a `cancel` method which when called, tries to remove the message from the queue early. `cancel` will return `true` if the message was removed (which resolves the promise) and `false` if it wasn't (the promise was already resolved).

```TS
const Channel = new Channel();

const takePromise1 = channel.take();
await channel.put("foo"); // Resolves immediately, and resolves `takePromise1` to "foo"

const putPromise1 = channel.put("bar");
const putPromise2 = channel.put("baz");
putPromise1.cancel(); // Resolves `putPromise1`, removing "bar" from the channel's message queue
await channel.take(); // Resolves to "baz", and resolves `putPromise2`
```

---

## take
`() => CancelablePromise<T>`

If the channel has messages, `take` takes the oldest message from the channel. If the channel is empty, `take` will queue a [`taker`](#design), which waits for a message to be passed. Returns a promise that resolves when a message has been taken from the channel. This promise will also contain a `cancel` method which when called, tries to remove the `taker` from the `taker` queue early. `cancel` will return `true` if the message was removed (which resolves the promise to `null`) and `false` if it wasn't (the promise was already resolved to a message).

```TS
const Channel = new Channel();

const putPromise1 = channel.put("foo");
await channel.take(); // Resolves to "foo" immediately, and resolves `putPromise1`

const takePromise1 = channel.take();
const takePromise2 = channel.take();
takePromise1.cancel("bar"); // Resolves `takePromise1` to "bar"
await channel.put("baz"); // Resolves immediately, and `takePromise2` to "baz"
```

---

## messages
`() => AsyncIterable<T>`

This is `take` but as an async iterable, which allows for this:

```TS
for await (const message of myChannel.messages()) {
  // Do stuff with message
}

It will loop forever, waiting for messages to enter the channel.
```

---

## drain
`() => T[]`

This is the only synchronous method. If there are any messages in the queue, this returns all of the queued messages, resolving the `put` calls that pushed them into the channel.

If there are no messages, the return is an empty array (since that is technically _all of the messages_). It is worth mentioning that this happens even if there are queued takers. `drain` does not reset the state of a channel, so if there are `takers` waiting on messages to enter the message queue, they'll still be there after `drain` is called.

```TS
const channel = new Channel();

const putPromise1 = channel.push("foo");
const putPromise2 = channel.push("bar");
channel.drain() // Resolves `putPromise1` and `putPromise2`, and returns ["foo", "bar"]
```

---

## sizeMessages
`() => number`

Basic introspection to check the current size of the message queue.

---

## sizeTakers
`() => number`

Basic introspecion to check the current size of the taker queue.

---

# Static Methods

## race
`(channels: Channel<T>[]) => Promise<T>`

Given an array of channels, this resolves to the first message received by any of the channels. If any channels contain messages when this is called, it resolves immediately to the message from the first message-containing channel in the array.

```TS
const channelA = new Channel();
const channelB = new Channel();

const racePromise = Channel.race([channelA, channelB]);
await channelA.put("foo"); // Resolves `racePromise` to "foo"
```

## select
`(channelMap: Map<K, Channel<T>>) => Promise<[T, K]>`, where `K` is the key type of the `channelMap`

Given a map of channels, this resolves to a tuple of the first message received by any of the channels and the key to which that channel belongs in the map. If any channels contain message when this is called, it resolves immediately to the first message-containing channel in the map. The order of elements in JS Maps is the insertion order.

```TS
const channelA = new Channel();
const channelB = new Channel();

const channelMap = new Map();
channelMap.set(1, channelA);
channelMap.set(2, channelB);

const selectPromise = Channel.select(channelMap);
await channelB.put("foo"); // Resolves `selectPromise` to ["foo", 2];
```

# Caveats for Race and Select

There are 2 important caveats to the static `race` and `select` methods.

1. For TypeScript, I did not type these functions such that it can accept any array/map of channels with different types. For the sake of simplicity, it is only type safe when all the channels in the passed array/map have the same type argument for `T`. `T` itself can be whatever type, so it's safe to have:

   ```TS
   const mixedChannelA = new Channel<string | number>();
   const mixedChannelB = new Channel<string | number>();

   Channel.race([mixedChannelA, mixedChannelB]); // Resolved value has type `string | number`
   ```

   But it's not type safe to do the following:

   ```TS
   const stringChannel = new Channel<string>();
   const numberChannel = new Channel<number>();

   Channel.race([stringChannel, numberChannel]);
   ```

   If you can think of a type safe way to handle the above, please create a pull request.

2. Because `race` and `select` work by enqueueing [`takers`](#design) if all message queues are empty, `race`/`select` aren't guaranteed to receive the literal first message received by any raced channel, since the `taker` queued by `race`/`select` might not be the first `taker` queued for that particular channel. Here's an example:

   ```TS
   const channelA = new Channel();
   const channelB = new Channel();

   // Since channelA is empty, this queues a taker into `channelA`.
   const takePromise = channelA.take();

   // Since channelA and channelB are both empty, this queues a taker into both.
   // For channelA, this is the second taker in the queue.
   const racePromise = Channel.race([ channelA, channelB ]);

   // This resolves `takePromise`, since that is what added the oldest `taker`.
   await channelA.put("foo");

   // Now `racePromise` is resolved, since that was the next oldest `taker`.
   await channelA.put("bar");
   ```

   Even though `"foo"` was the first message received by a raced channel, there was a taker waiting for messages before the race started.
