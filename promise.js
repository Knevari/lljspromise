const states = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
};

class LinkedListNode {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  append(value) {
    this.size++;
    const n = new LinkedListNode(value);

    if (!this.head) {
      this.head = n;
      this.tail = n;
    } else {
      this.tail.next = n;
      this.tail = n;
    }

    return this;
  }

  prepend(value) {
    this.size++;
    const n = new LinkedListNode(value, this.head);
    this.head = n;

    if (!this.tail) {
      this.tail = n;
    }

    return this;
  }

  deleteHead() {
    this.size--;
    let dHead = this.head;

    if (this.head === this.tail) {
      this.tail = null;
      this.head = null;
    } else {
      this.head = this.head.next;
    }

    return dHead;
  }

  deleteTail() {
    this.size--;
    let dTail = this.tail;

    if (this.head === this.tail) {
      this.tail = null;
      this.head = null;
      return dTail;
    }

    let current = this.head;

    while (current && current.next !== this.tail) {
      current = current.next;
    }

    if (current) {
      this.tail = current;
      this.tail.next = null;
    }

    return dTail;
  }

  traverse(callback) {
    let current = this.head;

    while (current) {
      callback(current.value);
      current = current.next;
    }
  }
}

class Queue {
  constructor() {
    this._linkedList = new LinkedList();
  }

  empty() {
    return this._linkedList.head === null;
  }

  peek() {
    if (this.empty()) return null;
    return this._linkedList.head.value;
  }

  enqueue(value) {
    this._linkedList.append(value);
  }

  dequeue() {
    return this._linkedList.deleteHead();
  }

  dequeueAll() {
    while (!this.empty()) this.dequeue();
  }

  forEach(callback) {
    this._linkedList.traverse((value) => {
      callback(value);
      this.dequeue();
    });
  }
}

const isThenable = maybePromise => maybePromise && typeof maybePromise.then === 'function';

class LLJSPromise {
  constructor(computation) {
    this._state = states.PENDING;
    this._value = undefined;
    this._reason = undefined;
    this._thenQueue = new Queue();
    this._finallyQueue = new Queue();

    if (typeof computation === 'function') {
      setTimeout(() => {
        try {
          computation(
            this._onFulfilled.bind(this),
            this._onRejected.bind(this)
          );
        } catch (err) {}
      });
    }
  }

  then(fulfilledFn, catchFn) {
    const controlledPromise = new LLJSPromise();
    this._thenQueue.enqueue([controlledPromise, fulfilledFn, catchFn]);

    if (this._state === states.FULFILLED) {
      this._propagateFulfilled();
    } else if (this._state === states.REJECTED) {
      this._propagateRejected();
    }

    return controlledPromise;
  }

  catch(catchFn) {
    return this.then(undefined, catchFn);
  }

  finally(sideEffectFn) {
    if (this._state !== states.PENDING) {
      sideEffectFn();
      return this._state === states.FULFILLED
      ? LLJSPromise.resolve(this._value)
      : LLJSPromise.reject(this._reason)
    }

    const controlledPromise = new LLJSPromise();
    this._finallyQueue.enqueue([controlledPromise, sideEffectFn]);

    return controlledPromise;
  }

  _propagateFulfilled() {
    this._thenQueue.forEach(([controlledPromise, fulfilledFn]) => {
      if (typeof fulfilledFn === 'function') {
        const valueOrPromise = fulfilledFn(this._value);

        if (isThenable(valueOrPromise)) {
          valueOrPromise.then(
            value => controlledPromise._onFulfilled(value),
            reason => controlledPromise._onRejected(reason)
          );
        } else {
          controlledPromise._onFulfilled(valueOrPromise);
        }
      } else {
        return controlledPromise._onFulfilled(this._value);
      }
    });

    this._finallyQueue.forEach(([controlledPromise, sideEffectFn]) => {
      sideEffectFn();
      controlledPromise._onFulfilled(this._value);
    });

    this._thenQueue.dequeueAll();
  }

  _propagateRejected() {
    this._thenQueue.forEach(([controlledPromise, _, catchFn]) => {
      if (typeof catchFn === 'function') {
        const valueOrPromise = catchFn(this._reason);

        if (isThenable(valueOrPromise)) {
          valueOrPromise.then(
            value => controlledPromise._onFulfilled(value),
            reason => controlledPromise._onRejected(reason)
          );
        } else {
          controlledPromise._onFulfilled(valueOrPromise);
        }
      } else {
        return controlledPromise._onRejected(this._reason);
      }
    });

    this._finallyQueue.forEach(([controlledPromise, sideEffectFn]) => {
      sideEffectFn();
      controlledPromise._onRejected(this._value);
    });

    this._thenQueue.dequeueAll();
  }

  _onFulfilled(value) {
    if (this._state === states.PENDING) {
      this._state = states.FULFILLED;
      this._value = value;
      this._propagateFulfilled();
    }
  }

  _onRejected(reason) {
    if (this._state === states.PENDING) {
      this._state = states.REJECTED;
      this._reason = reason;
      this._propagateRejected();
    }
  }

}

LLJSPromise.resolve = value => new LLJSPromise(resolve => resolve(value));
LLJSPromise.reject = value => new LLJSPromise((_, reject) => reject(value));

const fs = require('fs');
const path = require('path');

const readFile = (filename, encoding) => new LLJSPromise((resolve, reject) => {
  fs.readFile(filename, encoding, (err, value) => {
    if (err) {
      return reject(err);
    }
    resolve(value);
  });
});

const delay = (timeInMs, value) => new LLJSPromise(resolve => {
  setTimeout(() => {
    resolve(value);
  }, timeInMs);
});

readFile(path.join(__dirname, 'promise.js'), 'utf-8')
.then(text => {
  console.log(`${text.length} characters read`);
  return delay(2000, text.replace(/[aeiou]/g, ''));
})
.then(newText => {
  console.log(newText.slice(0, 200));
})
.catch(err => {
  console.log('An error ocurred', err);
})
.finally(() => {
  console.log('--- All done ---');
})
