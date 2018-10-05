(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global['bind-property'] = {})));
}(this, (function (exports) { 'use strict';

  const shareStore = new WeakMap();

  function createStore(source) {
    const store = {
      changeListeners: new Map(),
      preCommitListeners: new Map(),
      preCommitPriorityQueue: [],
      priorityQueue: []
    };
    shareStore.set(source, store);
    return store;
  }
  /**
   * The changeListeners listening for
   * property changes.
   *
   * @return Map
   */


  function getChangeListeners() {
    const store = shareStore.get(this) || createStore(this);
    return store.changeListeners;
  }
  /**
   * The changeListeners listening for
   * pre commit property changes.
   *
   * @return Map
   */

  function getPreCommitListeners() {
    const store = shareStore.get(this) || createStore(this);
    return store.preCommitListeners;
  }
  /**
   * The changeListeners listening for
   * pre commit property changes.
   *
   * @return Array
   */

  function getPriorityQueue(source, type = 'priorityQueue') {
    const store = shareStore.get(source) || createStore(source);
    return store[type];
  }
  /**
   * Adds a function as a change listener.
   * The callback will be provided
   *
   * @param {function} callback The callback that is notified of property changes.
   * @param {int} priority The priority of the callback. Larger number indicate lower priority
   */

  function addChangeListener(callback, priority = 0) {
    getPriorityQueue(this).length = 0;
    getChangeListeners.call(this).set(callback, priority);
  }
  /**
   * Removes a callback that has been previously added
   *
   * @param {function} callback The callback to remove
   */

  function removeChangeListener(callback) {
    getPriorityQueue(this).length = 0;
    getChangeListeners.call(this).delete(callback);
  }
  /**
   * Adds a function as a change listener.
   * The callback will be provided
   *
   * @param {function} callback The callback that is notified of property changes.
   * @param {int} priority The priority of the callback. Larger number indicate lower priority
   */

  function addPreCommitListener(callback, priority = 0) {
    getPriorityQueue(this, 'preCommitPriorityQueue').length = 0;
    getPreCommitListeners.call(this).set(callback, priority);
  }
  /**
   * Removes a callback that has been previously added
   *
   * @param {function} callback The callback to remove
   */

  function removePreCommitListener(callback) {
    getPriorityQueue(this, 'preCommitPriorityQueue').length = 0;
    getPreCommitListeners.call(this).delete(callback);
  }
  let changesByObject = new Map();
  let queue = new Set();
  let nextFrameId;
  /**
   * Function used to process property change
   * notifications by pooling and then executing
   * the notification changeListeners on the next tick.
   *
   * @param {Object} source The owner of the property being changed
   * @param {String} propertyName The name of the property that has changed
   * @param {Object} oldValue The value prior to the change
   * @param {Object} newValue The value after the change
   */

  function queueNotification(source, propertyName, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    let info = changesByObject.get(source);

    if (info === undefined) {
      info = {
        source: source,
        changes: {}
      };
      changesByObject.set(source, info);
    }

    const changes = info.changes;
    changes[propertyName] = {
      oldValue,
      newValue
    };
    queue.add(source);

    if (nextFrameId) {
      return;
    }

    const processQueue = function () {
      nextFrameId = requestAnimationFrame(function () {
        const processingQueue = queue;
        const processingChanges = changesByObject;
        queue = new Set();
        changesByObject = new Map();
        nextFrameId = null; // nullify to enable queuing again

        processingQueue.forEach(source => {
          const {
            changes
          } = processingChanges.get(source);
          notify(source, changes);
        }); // More items could have been queued during processing
        // Check for this and process them on the next frame

        if (queue.length) {
          processQueue();
        }
      });
    };

    processQueue();
  }
  function mixinNotifier(prototype) {
    Object.defineProperties(prototype, {
      changeListeners: {
        get: getChangeListeners
      },
      preCommitListeners: {
        get: getPreCommitListeners
      },
      addChangeListener: {
        value: addChangeListener
      },
      removeChangeListener: {
        value: removeChangeListener
      },
      addPreCommitListener: {
        value: addPreCommitListener
      },
      removePreCommitListener: {
        value: removePreCommitListener
      },
      suspendNotifications: {
        value: false,
        writable: true
      }
    });
  }
  /**
   * Notifies all changeListeners that a property has changed.
   *
   * @param {Object} source The owner of the property
   * @param {Object} changes The details of property changes that
   * occurred on the context
   */

  function notify(source, changes) {
    const queue = getPriorityQueue(source);

    if (queue.length === 0) {
      buildPriorityQueue(getChangeListeners.call(source), queue);
    }

    queue.forEach(function (entry) {
      entry.callback(source, changes, entry.priority);
    });
  }
  /**
   * Builds the priority queue
   *
   * @param {Map} callbackMap The Map containing the callbacks as the key and the priority as the value.
   * @param {Array} queue The array that will contain the queue sorted by priority.
   */


  function buildPriorityQueue(callbackMap, queue) {
    callbackMap.forEach(function (priority, callback) {
      queue.push({
        priority,
        callback
      });
    });
    queue.sort(priorityComparator);
  }
  /**
   * A basic sort comparator
   *
   * @param item1
   * @param item2
   * @returns {number}
   */

  function priorityComparator(item1, item2) {
    const p1 = ~~item1.priority;
    const p2 = ~~item2.priority;

    if (p1 === p2) {
      return 0;
    }

    return p1 > p2 ? 1 : -1;
  }

  const propertyValues = new WeakMap();

  function notifyPreCommit(source, changes) {
    let canceled = false;
    const queue = getPriorityQueue(source, 'preCommitPriorityQueue');

    if (queue.length === 0) {
      buildPriorityQueue(getPreCommitListeners.call(source), queue);
    }

    queue.forEach(function (item) {
      canceled = item.callback(source, changes, canceled, item.priority) === false || canceled;
    });
    return canceled;
  }
  /**
   * Structures the prototype to define a bindable property
   * on the first write when "this" is an instance of the
   * class or prototype.
   *
   * @param {Object} descriptor The Descriptor provided by the call to the decorator
   */


  function bindable(descriptor) {
    descriptor.finisher = function (clazz) {
      // Mixin
      mixinNotifier(clazz.prototype);
    };

    const {
      key
    } = descriptor;
    descriptor.kind = 'method';
    descriptor.placement = 'prototype';

    descriptor.descriptor = function (initializer = () => null, propertyDescriptor = {}, property) {
      return {
        get: propertyDescriptor.get || function () {
          return getValuesMap.call(this, property, initializer)[property];
        },
        set: function (newValue) {
          const self = this;
          const suspendNotifications = self.suspendNotifications;
          const valuesMap = getValuesMap.call(this, property, initializer);
          const oldValue = valuesMap[property];
          let value; // Honor an existing setter if any

          if (typeof propertyDescriptor.set === 'function') {
            propertyDescriptor.set.call(self, newValue); // Mutations? Casts?

            if (propertyDescriptor.get) {
              value = propertyDescriptor.get.call(self);
            }
          }

          if (value === newValue || notifyPreCommit(self, {
            [property]: {
              oldValue,
              newValue
            }
          })) {
            return;
          }

          valuesMap[property] = newValue;

          if (suspendNotifications === false && !getChangeListeners.call(self).values().next().done) {
            queueNotification(self, property, oldValue, newValue);
          }
        },
        enumerable: propertyDescriptor.enumerable !== undefined ? propertyDescriptor.enumerable : true
      };
    }(descriptor.initializer, descriptor.descriptor, key);

    delete descriptor.initializer;
    return descriptor;
  }

  function getValuesMap(property, initializer) {
    let valuesMap = propertyValues.get(this);

    if (!valuesMap) {
      valuesMap = {
        [property]: initializer()
      };
      propertyValues.set(this, valuesMap);
    }

    return valuesMap;
  }

  exports.bindable = bindable;
  exports.queueNotification = queueNotification;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
