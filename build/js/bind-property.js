(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global['bind-property'] = global['bind-property'] || {})));
}(this, (function (exports) { 'use strict';

var changeListeners = new WeakMap();
var preCommitListeners = new WeakMap();
/**
 * The changeListeners listening for
 * property changes.
 *
 * @return Set
 */
function getChangeListeners() {
    var self = this;
    if (changeListeners.has(self)) {
        return changeListeners.get(self);
    }
    var callbacks = new Set();
    changeListeners.set(self, callbacks);

    return callbacks;
}

/**
 * The changeListeners listening for
 * pre commit property changes.
 *
 * @return Set
 */
function getPreCommitListeners() {
    var self = this;
    if (preCommitListeners.has(self)) {
        return preCommitListeners.get(self);
    }
    var callbacks = new Set();
    preCommitListeners.set(self, callbacks);

    return callbacks;
}
/**
 * Adds a function as a change listener.
 * The callback will be provided
 *
 * @param {function} callback The callback that is notified of property changes.
 */
function addChangeListener(callback) {
    getChangeListeners.call(this).add(callback);
}

/**
 * Removes a callback that has been previously added
 *
 * @param {function} callback The callback to remove
 */
function removeChangeListener(callback) {
    getChangeListeners.call(this).delete(callback);
}

/**
 * Adds a function as a change listener.
 * The callback will be provided
 *
 * @param {function} callback The callback that is notified of property changes.
 */
function addPreCommitListener(callback) {
    getPreCommitListeners.call(this).add(callback);
}

/**
 * Removes a callback that has been previously added
 *
 * @param {function} callback The callback to remove
 */
function removePreCommitListener(callback) {
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
    source.changeListeners.forEach(function (callback) {
        callback(source, changes);
    });
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
    source.preCommitListeners.forEach(function (preCommitCallback) {
        canceled = preCommitCallback(source, changes, canceled) === false || canceled;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBjaGFuZ2VMaXN0ZW5lcnMgPSBuZXcgV2Vha01hcCgpO1xuY29uc3QgcHJlQ29tbWl0TGlzdGVuZXJzID0gbmV3IFdlYWtNYXAoKTtcbi8qKlxuICogVGhlIGNoYW5nZUxpc3RlbmVycyBsaXN0ZW5pbmcgZm9yXG4gKiBwcm9wZXJ0eSBjaGFuZ2VzLlxuICpcbiAqIEByZXR1cm4gU2V0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDaGFuZ2VMaXN0ZW5lcnMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGNoYW5nZUxpc3RlbmVycy5oYXMoc2VsZikpIHtcbiAgICAgICAgcmV0dXJuIGNoYW5nZUxpc3RlbmVycy5nZXQoc2VsZik7XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IG5ldyBTZXQoKTtcbiAgICBjaGFuZ2VMaXN0ZW5lcnMuc2V0KHNlbGYsIGNhbGxiYWNrcyk7XG5cbiAgICByZXR1cm4gY2FsbGJhY2tzO1xufVxuXG4vKipcbiAqIFRoZSBjaGFuZ2VMaXN0ZW5lcnMgbGlzdGVuaW5nIGZvclxuICogcHJlIGNvbW1pdCBwcm9wZXJ0eSBjaGFuZ2VzLlxuICpcbiAqIEByZXR1cm4gU2V0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcmVDb21taXRMaXN0ZW5lcnMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHByZUNvbW1pdExpc3RlbmVycy5oYXMoc2VsZikpIHtcbiAgICAgICAgcmV0dXJuIHByZUNvbW1pdExpc3RlbmVycy5nZXQoc2VsZik7XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IG5ldyBTZXQoKTtcbiAgICBwcmVDb21taXRMaXN0ZW5lcnMuc2V0KHNlbGYsIGNhbGxiYWNrcyk7XG5cbiAgICByZXR1cm4gY2FsbGJhY2tzO1xufVxuLyoqXG4gKiBBZGRzIGEgZnVuY3Rpb24gYXMgYSBjaGFuZ2UgbGlzdGVuZXIuXG4gKiBUaGUgY2FsbGJhY2sgd2lsbCBiZSBwcm92aWRlZFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0aGF0IGlzIG5vdGlmaWVkIG9mIHByb3BlcnR5IGNoYW5nZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRDaGFuZ2VMaXN0ZW5lcihjYWxsYmFjaykge1xuICAgIGdldENoYW5nZUxpc3RlbmVycy5jYWxsKHRoaXMpLmFkZChjYWxsYmFjayk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyBhIGNhbGxiYWNrIHRoYXQgaGFzIGJlZW4gcHJldmlvdXNseSBhZGRlZFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0byByZW1vdmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZUNoYW5nZUxpc3RlbmVyKGNhbGxiYWNrKSB7XG4gICAgZ2V0Q2hhbmdlTGlzdGVuZXJzLmNhbGwodGhpcykuZGVsZXRlKGNhbGxiYWNrKTtcbn1cblxuLyoqXG4gKiBBZGRzIGEgZnVuY3Rpb24gYXMgYSBjaGFuZ2UgbGlzdGVuZXIuXG4gKiBUaGUgY2FsbGJhY2sgd2lsbCBiZSBwcm92aWRlZFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0aGF0IGlzIG5vdGlmaWVkIG9mIHByb3BlcnR5IGNoYW5nZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRQcmVDb21taXRMaXN0ZW5lcihjYWxsYmFjaykge1xuICAgIGdldFByZUNvbW1pdExpc3RlbmVycy5jYWxsKHRoaXMpLmFkZChjYWxsYmFjayk7XG59XG5cbi8qKlxuICogUmVtb3ZlcyBhIGNhbGxiYWNrIHRoYXQgaGFzIGJlZW4gcHJldmlvdXNseSBhZGRlZFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0byByZW1vdmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVByZUNvbW1pdExpc3RlbmVyKGNhbGxiYWNrKSB7XG4gICAgZ2V0UHJlQ29tbWl0TGlzdGVuZXJzLmNhbGwodGhpcykuZGVsZXRlKGNhbGxiYWNrKTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemF0aW9uIGZ1bmN0aW9uIGZvciBhcHBseWluZyB2YWx1ZXMgdG8gb2JqZWN0cy5cbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIC8vIFNldCBjb21wbGV4IHByb3BlcnRpZXNcbiAqIGFwcGx5VmFsdWUoaHRtbERpdiwgJ3N0eWxlLnRyYW5zZm9ybScsICd0cmFuc2xhdGUzZCgyNXB4LCAyNXB4LCAwKScpO1xuICpcbiAqIC8vIGNhbGwgZnVuY3Rpb24gd2l0aCBhcmd1bWVudHNcbiAqIGFwcGx5VmFsdWUoaHRtbEJ1dHRvbiwgJ3NldEF0dHJpYnV0ZScsIFsnYXJpYS1zZWxlY3RlZCcsICd0cnVlJ10pO1xuICpcbiAqIC8vIGNhbGwgZnVuY3Rpb24gaW4gY29udGV4dFxuICogYXBwbHlWYWx1ZShodG1sSW5wdXQsIGZ1bmN0aW9uKG9iail7dGhpcy52YWx1ZSA9IG9iai5maXJzdE5hbWUgKyAnICcgKyBvYmoubGFzdE5hbWV9LCBteU9iamVjdCk7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHRhcmdldFNvdXJjZSBBbnkgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIHRhcmdldCBwYXRoXG4gKiBAcGFyYW0ge3N0cmluZyB8IGZ1bmN0aW9ufSBwYXRoIENhbiBiZSBhIHN0cmluZyBvciBmdW5jdGlvblxuICogQHBhcmFtIHsqfSB2YWx1ZSBBbnkgdmFsdWUgdG8gYXBwbHkuICBJZiB0aGUgcGF0aCBpcyBhIGZ1bmN0aW9uIGFuZCB0aGVcbiAqIHZhbHVlIGlzIGFuIGFycmF5LCBlYWNoIGVsZW1lbnQgaXMgcGFzc2VkIGFzIGFuIGFyZ3VtZW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlWYWx1ZSh0YXJnZXRTb3VyY2UsIHBhdGgsIHZhbHVlKSB7XG4gICAgY29uc3Qgc2ltcGxlID0gdHlwZW9mIHBhdGggIT09ICdzdHJpbmcnIHx8IHBhdGguaW5kZXhPZignLicpID09PSAtMTtcbiAgICBsZXQgdGFyZ2V0ID0gdGFyZ2V0U291cmNlO1xuICAgIGxldCBjb250ZXh0O1xuICAgIC8vIENoZWNrIGZvciBkZWVwIG9iamVjdCByZWZlcmVuY2VzXG4gICAgaWYgKCFzaW1wbGUpIHtcbiAgICAgICAgY29uc3QgcGF0aHMgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgICAgIGNvbnN0IGxlbiA9IH5+cGF0aHMubGVuZ3RoO1xuICAgICAgICBsZXQgaSA9IH5+MDtcbiAgICAgICAgZm9yICg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gcGF0aHNbaV07XG4gICAgICAgICAgICBjb250ZXh0ID0gdGFyZ2V0O1xuICAgICAgICAgICAgaWYgKGkgIT09IGxlbikge1xuICAgICAgICAgICAgICAgIHRhcmdldCA9IGNvbnRleHRbZnJhZ21lbnRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIENoZWNrIGZvciBtZW1iZXIgcHJvcGVydGllc1xuICAgIGVsc2UgaWYgKHR5cGVvZiBwYXRoID09PSAnZnVuY3Rpb24nICYmIHBhdGggaW4gdGFyZ2V0U291cmNlKSB7XG4gICAgICAgIHRhcmdldCA9IHRhcmdldFNvdXJjZVtwYXRoXTtcbiAgICAgICAgY29udGV4dCA9IHRhcmdldFNvdXJjZTtcbiAgICB9XG5cbiAgICAvLyBDYWxsIGZ1bmN0aW9uIGluIG91ciB0YXJnZXQncyBjb250ZXh0XG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gRmFzdGVyIHRoYW4gdmFsdWUgaW5zdGFuY2VvZiBBcnJheVxuICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUuc3BsaWNlKSB7XG4gICAgICAgICAgICB0YXJnZXQuYXBwbHkoY29udGV4dCwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0LmNhbGwoY29udGV4dCwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0YXJnZXRTb3VyY2VbcGF0aF0gPSB2YWx1ZTtcbiAgICB9XG59XG5cbmxldCBjaGFuZ2VzQnlPYmplY3QgPSBuZXcgTWFwKCk7XG5sZXQgcXVldWUgPSBuZXcgU2V0KCk7XG5cbmxldCBuZXh0RnJhbWVJZDtcblxuLyoqXG4gKiBGdW5jdGlvbiB1c2VkIHRvIHByb2Nlc3MgcHJvcGVydHkgY2hhbmdlXG4gKiBub3RpZmljYXRpb25zIGJ5IHBvb2xpbmcgYW5kIHRoZW4gZXhlY3V0aW5nXG4gKiB0aGUgbm90aWZpY2F0aW9uIGNoYW5nZUxpc3RlbmVycyBvbiB0aGUgbmV4dCB0aWNrLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIG93bmVyIG9mIHRoZSBwcm9wZXJ0eSBiZWluZyBjaGFuZ2VkXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlOYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGhhcyBjaGFuZ2VkXG4gKiBAcGFyYW0ge09iamVjdH0gb2xkVmFsdWUgVGhlIHZhbHVlIHByaW9yIHRvIHRoZSBjaGFuZ2VcbiAqIEBwYXJhbSB7T2JqZWN0fSBuZXdWYWx1ZSBUaGUgdmFsdWUgYWZ0ZXIgdGhlIGNoYW5nZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVldWVOb3RpZmljYXRpb24oc291cmNlLCBwcm9wZXJ0eU5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgIGlmIChvbGRWYWx1ZSA9PT0gbmV3VmFsdWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgaW5mbyA9IGNoYW5nZXNCeU9iamVjdC5nZXQoc291cmNlKTtcblxuICAgIGlmIChpbmZvID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaW5mbyA9IHtcbiAgICAgICAgICAgIHNvdXJjZTogc291cmNlLFxuICAgICAgICAgICAgY2hhbmdlczoge31cbiAgICAgICAgfTtcbiAgICAgICAgY2hhbmdlc0J5T2JqZWN0LnNldChzb3VyY2UsIGluZm8pO1xuICAgIH1cbiAgICBjb25zdCBjaGFuZ2VzID0gaW5mby5jaGFuZ2VzO1xuXG4gICAgY2hhbmdlc1twcm9wZXJ0eU5hbWVdID0ge29sZFZhbHVlLCBuZXdWYWx1ZX07XG4gICAgcXVldWUuYWRkKHNvdXJjZSk7XG4gICAgaWYgKG5leHRGcmFtZUlkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBuZXh0RnJhbWVJZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgIGNvbnN0IHByb2Nlc3NpbmdRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBjb25zdCBwcm9jZXNzaW5nQ2hhbmdlcyA9IGNoYW5nZXNCeU9iamVjdDtcbiAgICAgICAgcXVldWUgPSBuZXcgU2V0KCk7XG4gICAgICAgIGNoYW5nZXNCeU9iamVjdCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbmV4dEZyYW1lSWQgPSBudWxsOyAvLyBudWxsaWZ5IHRvIGVuYWJsZSBxdWV1aW5nIGFnYWluXG5cbiAgICAgICAgcHJvY2Vzc2luZ1F1ZXVlLmZvckVhY2goc291cmNlID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHtjaGFuZ2VzfSA9IHByb2Nlc3NpbmdDaGFuZ2VzLmdldChzb3VyY2UpO1xuICAgICAgICAgICAgbm90aWZ5KHNvdXJjZSwgY2hhbmdlcyk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWl4aW5Ob3RpZmllcihwcm90b3R5cGUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhwcm90b3R5cGUsIHtcbiAgICAgICAgY2hhbmdlTGlzdGVuZXJzOiB7XG4gICAgICAgICAgICBnZXQ6IGdldENoYW5nZUxpc3RlbmVyc1xuICAgICAgICB9LFxuXG4gICAgICAgIHByZUNvbW1pdExpc3RlbmVyczoge1xuICAgICAgICAgICAgZ2V0OiBnZXRQcmVDb21taXRMaXN0ZW5lcnNcbiAgICAgICAgfSxcbiAgICAgICAgYWRkQ2hhbmdlTGlzdGVuZXI6IHt2YWx1ZTogYWRkQ2hhbmdlTGlzdGVuZXJ9LFxuICAgICAgICByZW1vdmVDaGFuZ2VMaXN0ZW5lcjoge3ZhbHVlOiByZW1vdmVDaGFuZ2VMaXN0ZW5lcn0sXG4gICAgICAgIGFkZFByZUNvbW1pdExpc3RlbmVyOiB7dmFsdWU6IGFkZFByZUNvbW1pdExpc3RlbmVyfSxcbiAgICAgICAgcmVtb3ZlUHJlQ29tbWl0TGlzdGVuZXI6IHt2YWx1ZTogcmVtb3ZlUHJlQ29tbWl0TGlzdGVuZXJ9LFxuICAgICAgICBzdXNwZW5kTm90aWZpY2F0aW9uczoge3ZhbHVlOiBmYWxzZSwgd3JpdGFibGU6IHRydWV9XG4gICAgfSk7XG59XG5cbi8qKlxuICogTm90aWZpZXMgYWxsIGNoYW5nZUxpc3RlbmVycyB0aGF0IGEgcHJvcGVydHkgaGFzIGNoYW5nZWQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgb3duZXIgb2YgdGhlIHByb3BlcnR5XG4gKiBAcGFyYW0ge09iamVjdH0gY2hhbmdlcyBUaGUgZGV0YWlscyBvZiBwcm9wZXJ0eSBjaGFuZ2VzIHRoYXRcbiAqIG9jY3VycmVkIG9uIHRoZSBjb250ZXh0XG4gKi9cbmZ1bmN0aW9uIG5vdGlmeShzb3VyY2UsIGNoYW5nZXMpIHtcbiAgICBzb3VyY2UuY2hhbmdlTGlzdGVuZXJzLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICBjYWxsYmFjayhzb3VyY2UsIGNoYW5nZXMpO1xuICAgIH0pO1xufVxuIiwiaW1wb3J0IHttaXhpbk5vdGlmaWVyLCBxdWV1ZU5vdGlmaWNhdGlvbiwgZ2V0Q2hhbmdlTGlzdGVuZXJzfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgYWN0aXZlQmluZGluZ3MgPSBuZXcgV2Vha01hcCgpO1xuXG5mdW5jdGlvbiBjcmVhdGVHZXR0ZXIocHJvcGVydHkpIHtcblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICByZXR1cm4gZ2V0UHJvcGVydHlWYWx1ZXMoc2VsZilbcHJvcGVydHldO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlU2V0dGVyKHByb3BlcnR5LCBkZXNjcmlwdG9yKSB7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICBjb25zdCBzdXNwZW5kTm90aWZpY2F0aW9ucyA9IHNlbGYuc3VzcGVuZE5vdGlmaWNhdGlvbnM7XG4gICAgICAgIGxldCB2YWx1ZSA9IGdldFByb3BlcnR5VmFsdWVzKHNlbGYpW3Byb3BlcnR5XTtcbiAgICAgICAgLy8gSG9ub3IgYW4gZXhpc3Rpbmcgc2V0dGVyIGlmIGFueVxuICAgICAgICBpZiAodHlwZW9mIGRlc2NyaXB0b3Iuc2V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBkZXNjcmlwdG9yLnNldC5jYWxsKHNlbGYsIG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIC8vIE11dGF0aW9ucz8gQ2FzdHM/XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvci5nZXQpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGRlc2NyaXB0b3IuZ2V0LmNhbGwoc2VsZik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHZhbHVlID09PSBuZXdWYWx1ZSB8fCBub3RpZnlQcmVDb21taXQoc2VsZiwge1twcm9wZXJ0eV06IHtvbGRWYWx1ZSwgbmV3VmFsdWV9fSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICBpZiAoc3VzcGVuZE5vdGlmaWNhdGlvbnMgPT09IGZhbHNlICYmICFnZXRDaGFuZ2VMaXN0ZW5lcnMuY2FsbChzZWxmKS52YWx1ZXMoKS5uZXh0KCkuZG9uZSkge1xuICAgICAgICAgICAgcXVldWVOb3RpZmljYXRpb24oc2VsZiwgcHJvcGVydHksIG9sZFZhbHVlLCBuZXdWYWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgZ2V0UHJvcGVydHlWYWx1ZXMoc2VsZilbcHJvcGVydHldID0gdmFsdWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eVZhbHVlcyhjb250ZXh0KSB7XG4gICAgaWYgKGFjdGl2ZUJpbmRpbmdzLmhhcyhjb250ZXh0KSkge1xuICAgICAgICByZXR1cm4gYWN0aXZlQmluZGluZ3MuZ2V0KGNvbnRleHQpO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBhY3RpdmVCaW5kaW5ncy5zZXQoY29udGV4dCwgdmFsdWVzKTtcbiAgICByZXR1cm4gdmFsdWVzO1xufVxuXG5mdW5jdGlvbiBub3RpZnlQcmVDb21taXQoc291cmNlLCBjaGFuZ2VzKSB7XG4gICAgbGV0IGNhbmNlbGVkID0gZmFsc2U7XG4gICAgc291cmNlLnByZUNvbW1pdExpc3RlbmVycy5mb3JFYWNoKHByZUNvbW1pdENhbGxiYWNrID0+IHtcbiAgICAgICAgY2FuY2VsZWQgPSAocHJlQ29tbWl0Q2FsbGJhY2soc291cmNlLCBjaGFuZ2VzLCBjYW5jZWxlZCkgPT09IGZhbHNlKSB8fCBjYW5jZWxlZDtcbiAgICB9KTtcbiAgICByZXR1cm4gY2FuY2VsZWQ7XG59XG5cbi8qKlxuICogU3RydWN0dXJlcyB0aGUgcHJvdG90eXBlIHRvIGRlZmluZSBhIGJpbmRhYmxlIHByb3BlcnR5XG4gKiBvbiB0aGUgZmlyc3Qgd3JpdGUgd2hlbiBcInRoaXNcIiBpcyBhbiBpbnN0YW5jZSBvZiB0aGVcbiAqIGNsYXNzIG9yIHByb3RvdHlwZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIGJpbmRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJpbmRhYmxlKHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIGNvbnN0cnVjdG9yID0+IHtcbiAgICAgICAgLy8gTWl4aW5cbiAgICAgICAgY29uc3QgcHJvdG90eXBlID0gY29uc3RydWN0b3IucHJvdG90eXBlO1xuICAgICAgICBpZiAoIWFjdGl2ZUJpbmRpbmdzLmhhcyhwcm90b3R5cGUpKSB7XG4gICAgICAgICAgICBtaXhpbk5vdGlmaWVyKHByb3RvdHlwZSk7XG4gICAgICAgICAgICBhY3RpdmVCaW5kaW5ncy5zZXQocHJvdG90eXBlLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3RvdHlwZSwgcHJvcGVydHkpIHx8IHt9O1xuICAgICAgICAvLyBhbHJlYWR5IGJvdW5kIC0gbm90aGluZyB0byBkb1xuICAgICAgICBpZiAoYWN0aXZlQmluZGluZ3MuaGFzKGRlc2NyaXB0b3IuZ2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvdHlwZSwgcHJvcGVydHksIHtcbiAgICAgICAgICAgIGdldDogZGVzY3JpcHRvci5nZXQgfHwgY3JlYXRlR2V0dGVyKHByb3BlcnR5KSxcbiAgICAgICAgICAgIHNldDogY3JlYXRlU2V0dGVyKHByb3BlcnR5LCBkZXNjcmlwdG9yKSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGRlc2NyaXB0b3IuZW51bWVyYWJsZVxuICAgICAgICB9KTtcbiAgICB9O1xufVxuZXhwb3J0IHtxdWV1ZU5vdGlmaWNhdGlvbn07Il0sIm5hbWVzIjpbImNoYW5nZUxpc3RlbmVycyIsIldlYWtNYXAiLCJwcmVDb21taXRMaXN0ZW5lcnMiLCJnZXRDaGFuZ2VMaXN0ZW5lcnMiLCJzZWxmIiwiaGFzIiwiZ2V0IiwiY2FsbGJhY2tzIiwiU2V0Iiwic2V0IiwiZ2V0UHJlQ29tbWl0TGlzdGVuZXJzIiwiYWRkQ2hhbmdlTGlzdGVuZXIiLCJjYWxsYmFjayIsImNhbGwiLCJhZGQiLCJyZW1vdmVDaGFuZ2VMaXN0ZW5lciIsImRlbGV0ZSIsImFkZFByZUNvbW1pdExpc3RlbmVyIiwicmVtb3ZlUHJlQ29tbWl0TGlzdGVuZXIiLCJjaGFuZ2VzQnlPYmplY3QiLCJNYXAiLCJxdWV1ZSIsIm5leHRGcmFtZUlkIiwicXVldWVOb3RpZmljYXRpb24iLCJzb3VyY2UiLCJwcm9wZXJ0eU5hbWUiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwiaW5mbyIsInVuZGVmaW5lZCIsImNoYW5nZXMiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJwcm9jZXNzaW5nUXVldWUiLCJwcm9jZXNzaW5nQ2hhbmdlcyIsImZvckVhY2giLCJtaXhpbk5vdGlmaWVyIiwicHJvdG90eXBlIiwiZGVmaW5lUHJvcGVydGllcyIsInZhbHVlIiwid3JpdGFibGUiLCJub3RpZnkiLCJhY3RpdmVCaW5kaW5ncyIsImNyZWF0ZUdldHRlciIsInByb3BlcnR5IiwiZ2V0UHJvcGVydHlWYWx1ZXMiLCJjcmVhdGVTZXR0ZXIiLCJkZXNjcmlwdG9yIiwic3VzcGVuZE5vdGlmaWNhdGlvbnMiLCJub3RpZnlQcmVDb21taXQiLCJ2YWx1ZXMiLCJuZXh0IiwiZG9uZSIsImNvbnRleHQiLCJjYW5jZWxlZCIsInByZUNvbW1pdENhbGxiYWNrIiwiYmluZGFibGUiLCJjb25zdHJ1Y3RvciIsIk9iamVjdCIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImRlZmluZVByb3BlcnR5IiwiZW51bWVyYWJsZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBTUEsa0JBQWtCLElBQUlDLE9BQUosRUFBeEI7QUFDQSxJQUFNQyxxQkFBcUIsSUFBSUQsT0FBSixFQUEzQjs7Ozs7OztBQU9BLEFBQU8sU0FBU0Usa0JBQVQsR0FBOEI7UUFDM0JDLE9BQU8sSUFBYjtRQUNJSixnQkFBZ0JLLEdBQWhCLENBQW9CRCxJQUFwQixDQUFKLEVBQStCO2VBQ3BCSixnQkFBZ0JNLEdBQWhCLENBQW9CRixJQUFwQixDQUFQOztR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
