# ts-csp
A CSP (Communication Sequential Processes) written in TypeScript, based on [Paybase's csp library](https://github.com/paybase/csp)

## Motivation

There are already several CSP libraries out there, and `@paybase/csp` comes the closest to my needs of TypeScript support. However, I've run into my own issues while working with it, which mainly include:

* Lack of introspection on channels
* It would kinda be nice if channels were class objects with methods so I could have just one import
* Inability to cancel take/put operations based on timeouts

I primarily care about the first two, and have created a PR to have the first one addressed in a simple, elegant manner. However, the other two points would require massive refactoring. Also, there are some PRs sitting in that repo that have been waiting for months. I'm impatient, so sue me.
