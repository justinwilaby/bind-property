(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global['bind-property'] = global['bind-property'] || {})));
}(this, (function (exports) { 'use strict';

var shareStore = new WeakMap();

function createStore(source) {
    var store = {
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
    var store = shareStore.get(this) || createStore(this);
    return store.changeListeners;
}

/**
 * The changeListeners listening for
 * pre commit property changes.
 *
 * @return Map
 */
function getPreCommitListeners() {
    var store = shareStore.get(this) || createStore(this);
    return store.preCommitListeners;
}

/**
 * The changeListeners listening for
 * pre commit property changes.
 *
 * @return Array
 */
function getPriorityQueue(source) {
    var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'priorityQueue';

    var store = shareStore.get(source) || createStore(source);
    return store[type];
}

/**
 * Adds a function as a change listener.
 * The callback will be provided
 *
 * @param {function} callback The callback that is notified of property changes.
 * @param {int} priority The priority of the callback. Larger number indicate lower priority
 */
function addChangeListener(callback) {
    var priority = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

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
function addPreCommitListener(callback) {
    var priority = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

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


var changesByObject = new Map();
var queue = new Set();

var nextFrameId = void 0;

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
    var info = changesByObject.get(source);

    if (info === undefined) {
        info = {
            source: source,
            changes: {}
        };
        changesByObject.set(source, info);
    }
    var changes = info.changes;

    changes[propertyName] = { oldValue: oldValue, newValue: newValue };
    queue.add(source);
    if (nextFrameId) {
        return;
    }

    nextFrameId = requestAnimationFrame(function () {
        var processingQueue = queue;
        var processingChanges = changesByObject;
        queue = new Set();
        changesByObject = new Map();
        nextFrameId = null; // nullify to enable queuing again

        processingQueue.forEach(function (source) {
            var _processingChanges$ge = processingChanges.get(source),
                changes = _processingChanges$ge.changes;

            notify(source, changes);
        });
    });
}

function mixinNotifier(prototype) {
    Object.defineProperties(prototype, {
        changeListeners: {
            get: getChangeListeners
        },

        preCommitListeners: {
            get: getPreCommitListeners
        },
        addChangeListener: { value: addChangeListener },
        removeChangeListener: { value: removeChangeListener },
        addPreCommitListener: { value: addPreCommitListener },
        removePreCommitListener: { value: removePreCommitListener },
        suspendNotifications: { value: false, writable: true }
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
    var queue = getPriorityQueue(source);
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
        queue.push({ priority: priority, callback: callback });
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
    var p1 = ~~item1.priority;
    var p2 = ~~item2.priority;

    if (p1 === p2) {
        return 0;
    }

    return p1 > p2 ? 1 : -1;
}

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var activeBindings = new WeakMap();

function createGetter(property) {

    return function () {
        var self = this;
        return getPropertyValues(self)[property];
    };
}

function createSetter(property, descriptor) {

    return function (newValue) {
        var self = this;
        var suspendNotifications = self.suspendNotifications;
        var value = getPropertyValues(self)[property];
        // Honor an existing setter if any
        if (typeof descriptor.set === 'function') {
            descriptor.set.call(self, newValue);
            // Mutations? Casts?
            if (descriptor.get) {
                value = descriptor.get.call(self);
            }
        }
        var oldValue = value;
        if (value === newValue || notifyPreCommit(self, defineProperty({}, property, { oldValue: oldValue, newValue: newValue }))) {
            return;
        }
        value = newValue;
        if (suspendNotifications === false && !getChangeListeners.call(self).values().next().done) {
            queueNotification(self, property, oldValue, newValue);
        }
        getPropertyValues(self)[property] = value;
    };
}

function getPropertyValues(context) {
    if (activeBindings.has(context)) {
        return activeBindings.get(context);
    }
    var values = {};
    activeBindings.set(context, values);
    return values;
}

function notifyPreCommit(source, changes) {
    var canceled = false;
    var queue = getPriorityQueue(source, 'preCommitPriorityQueue');
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
 * @param {String} property The name of the property to bind
 */
function bindable(property) {
    return function (constructor) {
        // Mixin
        var prototype = constructor.prototype;
        if (!activeBindings.has(prototype)) {
            mixinNotifier(prototype);
            activeBindings.set(prototype, true);
        }

        var descriptor = Object.getOwnPropertyDescriptor(prototype, property) || {};
        // already bound - nothing to do
        if (activeBindings.has(descriptor.get)) {
            return;
        }

        Object.defineProperty(prototype, property, {
            get: descriptor.get || createGetter(property),
            set: createSetter(property, descriptor),
            enumerable: descriptor.enumerable
        });
    };
}

exports.bindable = bindable;
exports.queueNotification = queueNotification;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBzaGFyZVN0b3JlID0gbmV3IFdlYWtNYXAoKTtcblxuZnVuY3Rpb24gY3JlYXRlU3RvcmUoc291cmNlKXtcbiAgICBjb25zdCBzdG9yZSA9IHtcbiAgICAgICAgY2hhbmdlTGlzdGVuZXJzOiBuZXcgTWFwKCksXG4gICAgICAgIHByZUNvbW1pdExpc3RlbmVyczogbmV3IE1hcCgpLFxuICAgICAgICBwcmVDb21taXRQcmlvcml0eVF1ZXVlOiBbXSxcbiAgICAgICAgcHJpb3JpdHlRdWV1ZTogW11cbiAgICB9O1xuICAgIHNoYXJlU3RvcmUuc2V0KHNvdXJjZSwgc3RvcmUpO1xuICAgIHJldHVybiBzdG9yZTtcbn1cbi8qKlxuICogVGhlIGNoYW5nZUxpc3RlbmVycyBsaXN0ZW5pbmcgZm9yXG4gKiBwcm9wZXJ0eSBjaGFuZ2VzLlxuICpcbiAqIEByZXR1cm4gTWFwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDaGFuZ2VMaXN0ZW5lcnMoKSB7XG4gICAgY29uc3Qgc3RvcmUgPSBzaGFyZVN0b3JlLmdldCh0aGlzKSB8fCBjcmVhdGVTdG9yZSh0aGlzKTtcbiAgICByZXR1cm4gc3RvcmUuY2hhbmdlTGlzdGVuZXJzO1xufVxuXG4vKipcbiAqIFRoZSBjaGFuZ2VMaXN0ZW5lcnMgbGlzdGVuaW5nIGZvclxuICogcHJlIGNvbW1pdCBwcm9wZXJ0eSBjaGFuZ2VzLlxuICpcbiAqIEByZXR1cm4gTWFwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcmVDb21taXRMaXN0ZW5lcnMoKSB7XG4gIGNvbnN0IHN0b3JlID0gc2hhcmVTdG9yZS5nZXQodGhpcykgfHwgY3JlYXRlU3RvcmUodGhpcyk7XG4gIHJldHVybiBzdG9yZS5wcmVDb21taXRMaXN0ZW5lcnM7XG59XG5cbi8qKlxuICogVGhlIGNoYW5nZUxpc3RlbmVycyBsaXN0ZW5pbmcgZm9yXG4gKiBwcmUgY29tbWl0IHByb3BlcnR5IGNoYW5nZXMuXG4gKlxuICogQHJldHVybiBBcnJheVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJpb3JpdHlRdWV1ZShzb3VyY2UsIHR5cGUgPSAncHJpb3JpdHlRdWV1ZScpIHtcbiAgY29uc3Qgc3RvcmUgPSBzaGFyZVN0b3JlLmdldChzb3VyY2UpIHx8IGNyZWF0ZVN0b3JlKHNvdXJjZSk7XG4gIHJldHVybiBzdG9yZVt0eXBlXTtcbn1cblxuLyoqXG4gKiBBZGRzIGEgZnVuY3Rpb24gYXMgYSBjaGFuZ2UgbGlzdGVuZXIuXG4gKiBUaGUgY2FsbGJhY2sgd2lsbCBiZSBwcm92aWRlZFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0aGF0IGlzIG5vdGlmaWVkIG9mIHByb3BlcnR5IGNoYW5nZXMuXG4gKiBAcGFyYW0ge2ludH0gcHJpb3JpdHkgVGhlIHByaW9yaXR5IG9mIHRoZSBjYWxsYmFjay4gTGFyZ2VyIG51bWJlciBpbmRpY2F0ZSBsb3dlciBwcmlvcml0eVxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRkQ2hhbmdlTGlzdGVuZXIoY2FsbGJhY2ssIHByaW9yaXR5ID0gMCkge1xuICAgIGdldFByaW9yaXR5UXVldWUodGhpcykubGVuZ3RoID0gMDtcbiAgICBnZXRDaGFuZ2VMaXN0ZW5lcnMuY2FsbCh0aGlzKS5zZXQoY2FsbGJhY2ssIHByaW9yaXR5KTtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIGEgY2FsbGJhY2sgdGhhdCBoYXMgYmVlbiBwcmV2aW91c2x5IGFkZGVkXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRvIHJlbW92ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlQ2hhbmdlTGlzdGVuZXIoY2FsbGJhY2spIHtcbiAgICBnZXRQcmlvcml0eVF1ZXVlKHRoaXMpLmxlbmd0aCA9IDA7XG4gICAgZ2V0Q2hhbmdlTGlzdGVuZXJzLmNhbGwodGhpcykuZGVsZXRlKGNhbGxiYWNrKTtcbn1cblxuLyoqXG4gKiBBZGRzIGEgZnVuY3Rpb24gYXMgYSBjaGFuZ2UgbGlzdGVuZXIuXG4gKiBUaGUgY2FsbGJhY2sgd2lsbCBiZSBwcm92aWRlZFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0aGF0IGlzIG5vdGlmaWVkIG9mIHByb3BlcnR5IGNoYW5nZXMuXG4gKiBAcGFyYW0ge2ludH0gcHJpb3JpdHkgVGhlIHByaW9yaXR5IG9mIHRoZSBjYWxsYmFjay4gTGFyZ2VyIG51bWJlciBpbmRpY2F0ZSBsb3dlciBwcmlvcml0eVxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRkUHJlQ29tbWl0TGlzdGVuZXIoY2FsbGJhY2ssIHByaW9yaXR5ID0gMCkge1xuICAgIGdldFByaW9yaXR5UXVldWUodGhpcywgJ3ByZUNvbW1pdFByaW9yaXR5UXVldWUnKS5sZW5ndGggPSAwO1xuICAgIGdldFByZUNvbW1pdExpc3RlbmVycy5jYWxsKHRoaXMpLnNldChjYWxsYmFjaywgcHJpb3JpdHkpO1xufVxuXG4vKipcbiAqIFJlbW92ZXMgYSBjYWxsYmFjayB0aGF0IGhhcyBiZWVuIHByZXZpb3VzbHkgYWRkZWRcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gcmVtb3ZlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVQcmVDb21taXRMaXN0ZW5lcihjYWxsYmFjaykge1xuICAgIGdldFByaW9yaXR5UXVldWUodGhpcywgJ3ByZUNvbW1pdFByaW9yaXR5UXVldWUnKS5sZW5ndGggPSAwO1xuICAgIGdldFByZUNvbW1pdExpc3RlbmVycy5jYWxsKHRoaXMpLmRlbGV0ZShjYWxsYmFjayk7XG59XG5cbi8qKlxuICogTm9ybWFsaXphdGlvbiBmdW5jdGlvbiBmb3IgYXBwbHlpbmcgdmFsdWVzIHRvIG9iamVjdHMuXG4gKlxuICogQGV4YW1wbGVcbiAqXG4gKiAvLyBTZXQgY29tcGxleCBwcm9wZXJ0aWVzXG4gKiBhcHBseVZhbHVlKGh0bWxEaXYsICdzdHlsZS50cmFuc2Zvcm0nLCAndHJhbnNsYXRlM2QoMjVweCwgMjVweCwgMCknKTtcbiAqXG4gKiAvLyBjYWxsIGZ1bmN0aW9uIHdpdGggYXJndW1lbnRzXG4gKiBhcHBseVZhbHVlKGh0bWxCdXR0b24sICdzZXRBdHRyaWJ1dGUnLCBbJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZSddKTtcbiAqXG4gKiAvLyBjYWxsIGZ1bmN0aW9uIGluIGNvbnRleHRcbiAqIGFwcGx5VmFsdWUoaHRtbElucHV0LCBmdW5jdGlvbihvYmope3RoaXMudmFsdWUgPSBvYmouZmlyc3ROYW1lICsgJyAnICsgb2JqLmxhc3ROYW1lfSwgbXlPYmplY3QpO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0YXJnZXRTb3VyY2UgQW55IG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSB0YXJnZXQgcGF0aFxuICogQHBhcmFtIHtzdHJpbmcgfCBmdW5jdGlvbn0gcGF0aCBDYW4gYmUgYSBzdHJpbmcgb3IgZnVuY3Rpb25cbiAqIEBwYXJhbSB7Kn0gdmFsdWUgQW55IHZhbHVlIHRvIGFwcGx5LiAgSWYgdGhlIHBhdGggaXMgYSBmdW5jdGlvbiBhbmQgdGhlXG4gKiB2YWx1ZSBpcyBhbiBhcnJheSwgZWFjaCBlbGVtZW50IGlzIHBhc3NlZCBhcyBhbiBhcmd1bWVudC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5VmFsdWUodGFyZ2V0U291cmNlLCBwYXRoLCB2YWx1ZSkge1xuICAgIGNvbnN0IHNpbXBsZSA9IHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJyB8fCBwYXRoLmluZGV4T2YoJy4nKSA9PT0gLTE7XG4gICAgbGV0IHRhcmdldCA9IHRhcmdldFNvdXJjZTtcbiAgICBsZXQgY29udGV4dDtcbiAgICAvLyBDaGVjayBmb3IgZGVlcCBvYmplY3QgcmVmZXJlbmNlc1xuICAgIGlmICghc2ltcGxlKSB7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gcGF0aC5zcGxpdCgnLicpO1xuICAgICAgICBjb25zdCBsZW4gPSB+fnBhdGhzLmxlbmd0aDtcbiAgICAgICAgbGV0IGkgPSB+fjA7XG4gICAgICAgIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IHBhdGhzW2ldO1xuICAgICAgICAgICAgY29udGV4dCA9IHRhcmdldDtcbiAgICAgICAgICAgIGlmIChpICE9PSBsZW4pIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSBjb250ZXh0W2ZyYWdtZW50XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBDaGVjayBmb3IgbWVtYmVyIHByb3BlcnRpZXNcbiAgICBlbHNlIGlmICh0eXBlb2YgcGF0aCA9PT0gJ2Z1bmN0aW9uJyAmJiBwYXRoIGluIHRhcmdldFNvdXJjZSkge1xuICAgICAgICB0YXJnZXQgPSB0YXJnZXRTb3VyY2VbcGF0aF07XG4gICAgICAgIGNvbnRleHQgPSB0YXJnZXRTb3VyY2U7XG4gICAgfVxuXG4gICAgLy8gQ2FsbCBmdW5jdGlvbiBpbiBvdXIgdGFyZ2V0J3MgY29udGV4dFxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIEZhc3RlciB0aGFuIHZhbHVlIGluc3RhbmNlb2YgQXJyYXlcbiAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLnNwbGljZSkge1xuICAgICAgICAgICAgdGFyZ2V0LmFwcGx5KGNvbnRleHQsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRhcmdldC5jYWxsKGNvbnRleHQsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGFyZ2V0U291cmNlW3BhdGhdID0gdmFsdWU7XG4gICAgfVxufVxuXG5sZXQgY2hhbmdlc0J5T2JqZWN0ID0gbmV3IE1hcCgpO1xubGV0IHF1ZXVlID0gbmV3IFNldCgpO1xuXG5sZXQgbmV4dEZyYW1lSWQ7XG5cbi8qKlxuICogRnVuY3Rpb24gdXNlZCB0byBwcm9jZXNzIHByb3BlcnR5IGNoYW5nZVxuICogbm90aWZpY2F0aW9ucyBieSBwb29saW5nIGFuZCB0aGVuIGV4ZWN1dGluZ1xuICogdGhlIG5vdGlmaWNhdGlvbiBjaGFuZ2VMaXN0ZW5lcnMgb24gdGhlIG5leHQgdGljay5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIFRoZSBvd25lciBvZiB0aGUgcHJvcGVydHkgYmVpbmcgY2hhbmdlZFxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBoYXMgY2hhbmdlZFxuICogQHBhcmFtIHtPYmplY3R9IG9sZFZhbHVlIFRoZSB2YWx1ZSBwcmlvciB0byB0aGUgY2hhbmdlXG4gKiBAcGFyYW0ge09iamVjdH0gbmV3VmFsdWUgVGhlIHZhbHVlIGFmdGVyIHRoZSBjaGFuZ2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXVlTm90aWZpY2F0aW9uKHNvdXJjZSwgcHJvcGVydHlOYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICBpZiAob2xkVmFsdWUgPT09IG5ld1ZhbHVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IGluZm8gPSBjaGFuZ2VzQnlPYmplY3QuZ2V0KHNvdXJjZSk7XG5cbiAgICBpZiAoaW5mbyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGluZm8gPSB7XG4gICAgICAgICAgICBzb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICAgIGNoYW5nZXM6IHt9XG4gICAgICAgIH07XG4gICAgICAgIGNoYW5nZXNCeU9iamVjdC5zZXQoc291cmNlLCBpbmZvKTtcbiAgICB9XG4gICAgY29uc3QgY2hhbmdlcyA9IGluZm8uY2hhbmdlcztcblxuICAgIGNoYW5nZXNbcHJvcGVydHlOYW1lXSA9IHtvbGRWYWx1ZSwgbmV3VmFsdWV9O1xuICAgIHF1ZXVlLmFkZChzb3VyY2UpO1xuICAgIGlmIChuZXh0RnJhbWVJZCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbmV4dEZyYW1lSWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICBjb25zdCBwcm9jZXNzaW5nUXVldWUgPSBxdWV1ZTtcbiAgICAgICAgY29uc3QgcHJvY2Vzc2luZ0NoYW5nZXMgPSBjaGFuZ2VzQnlPYmplY3Q7XG4gICAgICAgIHF1ZXVlID0gbmV3IFNldCgpO1xuICAgICAgICBjaGFuZ2VzQnlPYmplY3QgPSBuZXcgTWFwKCk7XG4gICAgICAgIG5leHRGcmFtZUlkID0gbnVsbDsgLy8gbnVsbGlmeSB0byBlbmFibGUgcXVldWluZyBhZ2FpblxuXG4gICAgICAgIHByb2Nlc3NpbmdRdWV1ZS5mb3JFYWNoKHNvdXJjZSA9PiB7XG4gICAgICAgICAgICBjb25zdCB7Y2hhbmdlc30gPSBwcm9jZXNzaW5nQ2hhbmdlcy5nZXQoc291cmNlKTtcbiAgICAgICAgICAgIG5vdGlmeShzb3VyY2UsIGNoYW5nZXMpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1peGluTm90aWZpZXIocHJvdG90eXBlKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMocHJvdG90eXBlLCB7XG4gICAgICAgIGNoYW5nZUxpc3RlbmVyczoge1xuICAgICAgICAgICAgZ2V0OiBnZXRDaGFuZ2VMaXN0ZW5lcnNcbiAgICAgICAgfSxcblxuICAgICAgICBwcmVDb21taXRMaXN0ZW5lcnM6IHtcbiAgICAgICAgICAgIGdldDogZ2V0UHJlQ29tbWl0TGlzdGVuZXJzXG4gICAgICAgIH0sXG4gICAgICAgIGFkZENoYW5nZUxpc3RlbmVyOiB7dmFsdWU6IGFkZENoYW5nZUxpc3RlbmVyfSxcbiAgICAgICAgcmVtb3ZlQ2hhbmdlTGlzdGVuZXI6IHt2YWx1ZTogcmVtb3ZlQ2hhbmdlTGlzdGVuZXJ9LFxuICAgICAgICBhZGRQcmVDb21taXRMaXN0ZW5lcjoge3ZhbHVlOiBhZGRQcmVDb21taXRMaXN0ZW5lcn0sXG4gICAgICAgIHJlbW92ZVByZUNvbW1pdExpc3RlbmVyOiB7dmFsdWU6IHJlbW92ZVByZUNvbW1pdExpc3RlbmVyfSxcbiAgICAgICAgc3VzcGVuZE5vdGlmaWNhdGlvbnM6IHt2YWx1ZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlfVxuICAgIH0pO1xufVxuXG4vKipcbiAqIE5vdGlmaWVzIGFsbCBjaGFuZ2VMaXN0ZW5lcnMgdGhhdCBhIHByb3BlcnR5IGhhcyBjaGFuZ2VkLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIG93bmVyIG9mIHRoZSBwcm9wZXJ0eVxuICogQHBhcmFtIHtPYmplY3R9IGNoYW5nZXMgVGhlIGRldGFpbHMgb2YgcHJvcGVydHkgY2hhbmdlcyB0aGF0XG4gKiBvY2N1cnJlZCBvbiB0aGUgY29udGV4dFxuICovXG5mdW5jdGlvbiBub3RpZnkoc291cmNlLCBjaGFuZ2VzKSB7XG4gICAgY29uc3QgcXVldWUgPSBnZXRQcmlvcml0eVF1ZXVlKHNvdXJjZSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMCl7XG4gICAgICAgIGJ1aWxkUHJpb3JpdHlRdWV1ZShnZXRDaGFuZ2VMaXN0ZW5lcnMuY2FsbChzb3VyY2UpLCBxdWV1ZSk7XG4gICAgfVxuICAgIHF1ZXVlLmZvckVhY2goZnVuY3Rpb24oZW50cnkpe1xuICAgICAgZW50cnkuY2FsbGJhY2soc291cmNlLCBjaGFuZ2VzLCBlbnRyeS5wcmlvcml0eSk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogQnVpbGRzIHRoZSBwcmlvcml0eSBxdWV1ZVxuICpcbiAqIEBwYXJhbSB7TWFwfSBjYWxsYmFja01hcCBUaGUgTWFwIGNvbnRhaW5pbmcgdGhlIGNhbGxiYWNrcyBhcyB0aGUga2V5IGFuZCB0aGUgcHJpb3JpdHkgYXMgdGhlIHZhbHVlLlxuICogQHBhcmFtIHtBcnJheX0gcXVldWUgVGhlIGFycmF5IHRoYXQgd2lsbCBjb250YWluIHRoZSBxdWV1ZSBzb3J0ZWQgYnkgcHJpb3JpdHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFByaW9yaXR5UXVldWUoY2FsbGJhY2tNYXAsIHF1ZXVlKSB7XG4gIGNhbGxiYWNrTWFwLmZvckVhY2goZnVuY3Rpb24ocHJpb3JpdHksIGNhbGxiYWNrKSB7XG4gICAgcXVldWUucHVzaCh7cHJpb3JpdHksIGNhbGxiYWNrfSk7XG4gIH0pO1xuICBxdWV1ZS5zb3J0KHByaW9yaXR5Q29tcGFyYXRvcik7XG59XG5cbi8qKlxuICogQSBiYXNpYyBzb3J0IGNvbXBhcmF0b3JcbiAqXG4gKiBAcGFyYW0gaXRlbTFcbiAqIEBwYXJhbSBpdGVtMlxuICogQHJldHVybnMge251bWJlcn1cbiAqL1xuZnVuY3Rpb24gcHJpb3JpdHlDb21wYXJhdG9yKGl0ZW0xLCBpdGVtMil7XG4gICAgY29uc3QgcDEgPSB+fml0ZW0xLnByaW9yaXR5O1xuICAgIGNvbnN0IHAyID0gfn5pdGVtMi5wcmlvcml0eTtcblxuICAgIGlmIChwMSA9PT0gcDIpe1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gcDEgPiBwMiA/IDEgOiAtMTtcbn1cbiIsImltcG9ydCB7XG4gICAgbWl4aW5Ob3RpZmllcixcbiAgICBxdWV1ZU5vdGlmaWNhdGlvbixcbiAgICBnZXRDaGFuZ2VMaXN0ZW5lcnMsXG4gICAgZ2V0UHJpb3JpdHlRdWV1ZSxcbiAgICBnZXRQcmVDb21taXRMaXN0ZW5lcnMsXG4gICAgYnVpbGRQcmlvcml0eVF1ZXVlXG59IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBhY3RpdmVCaW5kaW5ncyA9IG5ldyBXZWFrTWFwKCk7XG5cbmZ1bmN0aW9uIGNyZWF0ZUdldHRlcihwcm9wZXJ0eSkge1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIHJldHVybiBnZXRQcm9wZXJ0eVZhbHVlcyhzZWxmKVtwcm9wZXJ0eV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVTZXR0ZXIocHJvcGVydHksIGRlc2NyaXB0b3IpIHtcblxuICAgIHJldHVybiBmdW5jdGlvbiAobmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIGNvbnN0IHN1c3BlbmROb3RpZmljYXRpb25zID0gc2VsZi5zdXNwZW5kTm90aWZpY2F0aW9ucztcbiAgICAgICAgbGV0IHZhbHVlID0gZ2V0UHJvcGVydHlWYWx1ZXMoc2VsZilbcHJvcGVydHldO1xuICAgICAgICAvLyBIb25vciBhbiBleGlzdGluZyBzZXR0ZXIgaWYgYW55XG4gICAgICAgIGlmICh0eXBlb2YgZGVzY3JpcHRvci5zZXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGRlc2NyaXB0b3Iuc2V0LmNhbGwoc2VsZiwgbmV3VmFsdWUpO1xuICAgICAgICAgICAgLy8gTXV0YXRpb25zPyBDYXN0cz9cbiAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yLmdldCkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gZGVzY3JpcHRvci5nZXQuY2FsbChzZWxmKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgPT09IG5ld1ZhbHVlIHx8IG5vdGlmeVByZUNvbW1pdChzZWxmLCB7W3Byb3BlcnR5XToge29sZFZhbHVlLCBuZXdWYWx1ZX19KSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhbHVlID0gbmV3VmFsdWU7XG4gICAgICAgIGlmIChzdXNwZW5kTm90aWZpY2F0aW9ucyA9PT0gZmFsc2UgJiYgIWdldENoYW5nZUxpc3RlbmVycy5jYWxsKHNlbGYpLnZhbHVlcygpLm5leHQoKS5kb25lKSB7XG4gICAgICAgICAgICBxdWV1ZU5vdGlmaWNhdGlvbihzZWxmLCBwcm9wZXJ0eSwgb2xkVmFsdWUsIG5ld1ZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBnZXRQcm9wZXJ0eVZhbHVlcyhzZWxmKVtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFByb3BlcnR5VmFsdWVzKGNvbnRleHQpIHtcbiAgICBpZiAoYWN0aXZlQmluZGluZ3MuaGFzKGNvbnRleHQpKSB7XG4gICAgICAgIHJldHVybiBhY3RpdmVCaW5kaW5ncy5nZXQoY29udGV4dCk7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGFjdGl2ZUJpbmRpbmdzLnNldChjb250ZXh0LCB2YWx1ZXMpO1xuICAgIHJldHVybiB2YWx1ZXM7XG59XG5cbmZ1bmN0aW9uIG5vdGlmeVByZUNvbW1pdChzb3VyY2UsIGNoYW5nZXMpIHtcbiAgICBsZXQgY2FuY2VsZWQgPSBmYWxzZTtcbiAgICBjb25zdCBxdWV1ZSA9IGdldFByaW9yaXR5UXVldWUoc291cmNlLCAncHJlQ29tbWl0UHJpb3JpdHlRdWV1ZScpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDApe1xuICAgICAgICBidWlsZFByaW9yaXR5UXVldWUoZ2V0UHJlQ29tbWl0TGlzdGVuZXJzLmNhbGwoc291cmNlKSwgcXVldWUpO1xuICAgIH1cbiAgICBxdWV1ZS5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIGNhbmNlbGVkID0gKGl0ZW0uY2FsbGJhY2soc291cmNlLCBjaGFuZ2VzLCBjYW5jZWxlZCwgaXRlbS5wcmlvcml0eSkgPT09IGZhbHNlKSB8fCBjYW5jZWxlZDtcbiAgICB9KTtcbiAgICByZXR1cm4gY2FuY2VsZWQ7XG59XG5cbi8qKlxuICogU3RydWN0dXJlcyB0aGUgcHJvdG90eXBlIHRvIGRlZmluZSBhIGJpbmRhYmxlIHByb3BlcnR5XG4gKiBvbiB0aGUgZmlyc3Qgd3JpdGUgd2hlbiBcInRoaXNcIiBpcyBhbiBpbnN0YW5jZSBvZiB0aGVcbiAqIGNsYXNzIG9yIHByb3RvdHlwZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIGJpbmRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJpbmRhYmxlKHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIGNvbnN0cnVjdG9yID0+IHtcbiAgICAgICAgLy8gTWl4aW5cbiAgICAgICAgY29uc3QgcHJvdG90eXBlID0gY29uc3RydWN0b3IucHJvdG90eXBlO1xuICAgICAgICBpZiAoIWFjdGl2ZUJpbmRpbmdzLmhhcyhwcm90b3R5cGUpKSB7XG4gICAgICAgICAgICBtaXhpbk5vdGlmaWVyKHByb3RvdHlwZSk7XG4gICAgICAgICAgICBhY3RpdmVCaW5kaW5ncy5zZXQocHJvdG90eXBlLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3RvdHlwZSwgcHJvcGVydHkpIHx8IHt9O1xuICAgICAgICAvLyBhbHJlYWR5IGJvdW5kIC0gbm90aGluZyB0byBkb1xuICAgICAgICBpZiAoYWN0aXZlQmluZGluZ3MuaGFzKGRlc2NyaXB0b3IuZ2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvdHlwZSwgcHJvcGVydHksIHtcbiAgICAgICAgICAgIGdldDogZGVzY3JpcHRvci5nZXQgfHwgY3JlYXRlR2V0dGVyKHByb3BlcnR5KSxcbiAgICAgICAgICAgIHNldDogY3JlYXRlU2V0dGVyKHByb3BlcnR5LCBkZXNjcmlwdG9yKSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGRlc2NyaXB0b3IuZW51bWVyYWJsZVxuICAgICAgICB9KTtcbiAgICB9O1xufVxuZXhwb3J0IHtxdWV1ZU5vdGlmaWNhdGlvbn07Il0sIm5hbWVzIjpbInNoYXJlU3RvcmUiLCJXZWFrTWFwIiwiY3JlYXRlU3RvcmUiLCJzb3VyY2UiLCJzdG9yZSIsIk1hcCIsInNldCIsImdldENoYW5nZUxpc3RlbmVycyIsImdldCIsImNoYW5nZUxpc3RlbmVycyIsImdldFByZUNvbW1pdExpc3RlbmVycyIsInByZUNvbW1pdExpc3RlbmVycyIsImdldFByaW9yaXR5UXVldWUiLCJ0eXBlIiwiYWRkQ2hhbmdlTGlzdGVuZXIiLCJjYWxsYmFjayIsInByaW9yaXR5IiwibGVuZ3RoIiwiY2FsbCIsInJlbW92ZUNoYW5nZUxpc3RlbmVyIiwiZGVsZXRlIiwiYWRkUHJlQ29tbWl0TGlzdGVuZXIiLCJyZW1vdmVQcmVDb21taXRMaXN0ZW5lciIsImNoYW5nZXNCeU9iamVjdCIsInF1ZXVlIiwiU2V0IiwibmV4dEZyYW1lSWQiLCJxdWV1ZU5vdGlmaWNhdGlvbiIsInByb3BlcnR5TmFtZSIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJpbmZvIiwidW5kZWZpbmVkIiwiY2hhbmdlcyIsImFkZCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInByb2Nlc3NpbmdRdWV1ZSIsInByb2Nlc3NpbmdDaGFuZ2VzIiwiZm9yRWFjaCIsIm1peGluTm90aWZpZXIiLCJwcm90b3R5cGUiLCJkZWZpbmVQcm9wZXJ0aWVzIiwidmFsdWUiLCJ3cml0YWJsZSIsIm5vdGlmeSIsImVudHJ5IiwiYnVpbGRQcmlvcml0eVF1ZXVlIiwiY2FsbGJhY2tNYXAiLCJwdXNoIiwic29ydCIsInByaW9yaXR5Q29tcGFyYXRvciIsIml0ZW0xIiwiaXRlbTIiLCJwMSIsInAyIiwiYWN0aXZlQmluZGluZ3MiLCJjcmVhdGVHZXR0ZXIiLCJwcm9wZXJ0eSIsInNlbGYiLCJnZXRQcm9wZXJ0eVZhbHVlcyIsImNyZWF0ZVNldHRlciIsImRlc2NyaXB0b3IiLCJzdXNwZW5kTm90aWZpY2F0aW9ucyIsIm5vdGlmeVByZUNvbW1pdCIsInZhbHVlcyIsIm5leHQiLCJkb25lIiwiY29udGV4dCIsImhhcyIsImNhbmNlbGVkIiwiaXRlbSIsImJpbmRhYmxlIiwiY29uc3RydWN0b3IiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJkZWZpbmVQcm9wZXJ0eSIsImVudW1lcmFibGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQU1BLGFBQWEsSUFBSUMs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
