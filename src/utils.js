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
export function getChangeListeners() {
  const store = shareStore.get(this) || createStore(this);
  return store.changeListeners;
}

/**
 * The changeListeners listening for
 * pre commit property changes.
 *
 * @return Map
 */
export function getPreCommitListeners() {
  const store = shareStore.get(this) || createStore(this);
  return store.preCommitListeners;
}

/**
 * The changeListeners listening for
 * pre commit property changes.
 *
 * @return Array
 */
export function getPriorityQueue(source, type = 'priorityQueue') {
  const store = shareStore.get(source) || createStore(source);
  return store[ type ];
}

/**
 * Adds a function as a change listener.
 * The callback will be provided
 *
 * @param {function} callback The callback that is notified of property changes.
 * @param {int} priority The priority of the callback. Larger number indicate lower priority
 */
export function addChangeListener(callback, priority = 0) {
  getPriorityQueue(this).length = 0;
  getChangeListeners.call(this).set(callback, priority);
}

/**
 * Removes a callback that has been previously added
 *
 * @param {function} callback The callback to remove
 */
export function removeChangeListener(callback) {
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
export function addPreCommitListener(callback, priority = 0) {
  getPriorityQueue(this, 'preCommitPriorityQueue').length = 0;
  getPreCommitListeners.call(this).set(callback, priority);
}

/**
 * Removes a callback that has been previously added
 *
 * @param {function} callback The callback to remove
 */
export function removePreCommitListener(callback) {
  getPriorityQueue(this, 'preCommitPriorityQueue').length = 0;
  getPreCommitListeners.call(this).delete(callback);
}

/**
 * Normalization function for applying values to objects.
 *
 * @example
 *
 * // Set complex properties
 * applyValue(htmlDiv, 'style.transform', 'translate3d(25px, 25px, 0)');
 *
 * // call function with arguments
 * applyValue(htmlButton, 'setAttribute', ['aria-selected', 'true']);
 *
 * // call function in context
 * applyValue(htmlInput, function(obj){this.value = obj.firstName + ' ' + obj.lastName}, myObject);
 *
 * @param {Object} targetSource Any object that contains the target path
 * @param {string | function} path Can be a string or function
 * @param {*} value Any value to apply.  If the path is a function and the
 * value is an array, each element is passed as an argument.
 */
export function applyValue(targetSource, path, value) {
  const simple = typeof path !== 'string' || path.indexOf('.') === -1;
  let target = targetSource;
  let context;
  // Check for deep object references
  if (!simple) {
    const paths = path.split('.');
    const len = ~~paths.length;
    let i = ~~0;
    for (; i < len; i++) {
      let fragment = paths[ i ];
      context = target;
      if (i !== len) {
        target = context[ fragment ];
      }
    }
  }
  // Check for member properties
  else if (typeof path === 'function' && path in targetSource) {
    target = targetSource[ path ];
    context = targetSource;
  }

  // Call function in our target's context
  if (typeof target === 'function') {
    // Faster than value instanceof Array
    if (value && value.splice) {
      target.apply(context, value);
    }
    else {
      target.call(context, value);
    }
  }
  else {
    targetSource[ path ] = value;
  }
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
export function queueNotification(source, propertyName, oldValue, newValue) {
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

  changes[ propertyName ] = {oldValue, newValue};
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
        const {changes} = processingChanges.get(source);
        notify(source, changes);
      });
      // More items could have been queued during processing
      // Check for this and process them on the next frame
      if (queue.length) {
        processQueue();
      }
    });
  };

  processQueue();
}

export function mixinNotifier(prototype) {
  Object.defineProperties(prototype, {
    changeListeners: {
      get: getChangeListeners
    },

    preCommitListeners: {
      get: getPreCommitListeners
    },
    addChangeListener: {value: addChangeListener},
    removeChangeListener: {value: removeChangeListener},
    addPreCommitListener: {value: addPreCommitListener},
    removePreCommitListener: {value: removePreCommitListener},
    suspendNotifications: {value: false, writable: true}
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
export function buildPriorityQueue(callbackMap, queue) {
  callbackMap.forEach(function (priority, callback) {
    queue.push({priority, callback});
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
