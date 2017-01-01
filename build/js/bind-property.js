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

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBjaGFuZ2VMaXN0ZW5lcnMgPSBuZXcgV2Vha01hcCgpO1xyXG5jb25zdCBwcmVDb21taXRMaXN0ZW5lcnMgPSBuZXcgV2Vha01hcCgpO1xyXG4vKipcclxuICogVGhlIGNoYW5nZUxpc3RlbmVycyBsaXN0ZW5pbmcgZm9yXHJcbiAqIHByb3BlcnR5IGNoYW5nZXMuXHJcbiAqXHJcbiAqIEByZXR1cm4gU2V0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2hhbmdlTGlzdGVuZXJzKCkge1xyXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XHJcbiAgICBpZiAoY2hhbmdlTGlzdGVuZXJzLmhhcyhzZWxmKSkge1xyXG4gICAgICAgIHJldHVybiBjaGFuZ2VMaXN0ZW5lcnMuZ2V0KHNlbGYpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY2FsbGJhY2tzID0gbmV3IFNldCgpO1xyXG4gICAgY2hhbmdlTGlzdGVuZXJzLnNldChzZWxmLCBjYWxsYmFja3MpO1xyXG5cclxuICAgIHJldHVybiBjYWxsYmFja3M7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUaGUgY2hhbmdlTGlzdGVuZXJzIGxpc3RlbmluZyBmb3JcclxuICogcHJlIGNvbW1pdCBwcm9wZXJ0eSBjaGFuZ2VzLlxyXG4gKlxyXG4gKiBAcmV0dXJuIFNldFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFByZUNvbW1pdExpc3RlbmVycygpIHtcclxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xyXG4gICAgaWYgKHByZUNvbW1pdExpc3RlbmVycy5oYXMoc2VsZikpIHtcclxuICAgICAgICByZXR1cm4gcHJlQ29tbWl0TGlzdGVuZXJzLmdldChzZWxmKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IG5ldyBTZXQoKTtcclxuICAgIHByZUNvbW1pdExpc3RlbmVycy5zZXQoc2VsZiwgY2FsbGJhY2tzKTtcclxuXHJcbiAgICByZXR1cm4gY2FsbGJhY2tzO1xyXG59XHJcbi8qKlxyXG4gKiBBZGRzIGEgZnVuY3Rpb24gYXMgYSBjaGFuZ2UgbGlzdGVuZXIuXHJcbiAqIFRoZSBjYWxsYmFjayB3aWxsIGJlIHByb3ZpZGVkXHJcbiAqXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0aGF0IGlzIG5vdGlmaWVkIG9mIHByb3BlcnR5IGNoYW5nZXMuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYWRkQ2hhbmdlTGlzdGVuZXIoY2FsbGJhY2spIHtcclxuICAgIGdldENoYW5nZUxpc3RlbmVycy5jYWxsKHRoaXMpLmFkZChjYWxsYmFjayk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZW1vdmVzIGEgY2FsbGJhY2sgdGhhdCBoYXMgYmVlbiBwcmV2aW91c2x5IGFkZGVkXHJcbiAqXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0byByZW1vdmVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVDaGFuZ2VMaXN0ZW5lcihjYWxsYmFjaykge1xyXG4gICAgZ2V0Q2hhbmdlTGlzdGVuZXJzLmNhbGwodGhpcykuZGVsZXRlKGNhbGxiYWNrKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgYSBmdW5jdGlvbiBhcyBhIGNoYW5nZSBsaXN0ZW5lci5cclxuICogVGhlIGNhbGxiYWNrIHdpbGwgYmUgcHJvdmlkZWRcclxuICpcclxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRoYXQgaXMgbm90aWZpZWQgb2YgcHJvcGVydHkgY2hhbmdlcy5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGRQcmVDb21taXRMaXN0ZW5lcihjYWxsYmFjaykge1xyXG4gICAgZ2V0UHJlQ29tbWl0TGlzdGVuZXJzLmNhbGwodGhpcykuYWRkKGNhbGxiYWNrKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlbW92ZXMgYSBjYWxsYmFjayB0aGF0IGhhcyBiZWVuIHByZXZpb3VzbHkgYWRkZWRcclxuICpcclxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIHRvIHJlbW92ZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVByZUNvbW1pdExpc3RlbmVyKGNhbGxiYWNrKSB7XHJcbiAgICBnZXRQcmVDb21taXRMaXN0ZW5lcnMuY2FsbCh0aGlzKS5kZWxldGUoY2FsbGJhY2spO1xyXG59XHJcblxyXG4vKipcclxuICogTm9ybWFsaXphdGlvbiBmdW5jdGlvbiBmb3IgYXBwbHlpbmcgdmFsdWVzIHRvIG9iamVjdHMuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqIC8vIFNldCBjb21wbGV4IHByb3BlcnRpZXNcclxuICogYXBwbHlWYWx1ZShodG1sRGl2LCAnc3R5bGUudHJhbnNmb3JtJywgJ3RyYW5zbGF0ZTNkKDI1cHgsIDI1cHgsIDApJyk7XHJcbiAqXHJcbiAqIC8vIGNhbGwgZnVuY3Rpb24gd2l0aCBhcmd1bWVudHNcclxuICogYXBwbHlWYWx1ZShodG1sQnV0dG9uLCAnc2V0QXR0cmlidXRlJywgWydhcmlhLXNlbGVjdGVkJywgJ3RydWUnXSk7XHJcbiAqXHJcbiAqIC8vIGNhbGwgZnVuY3Rpb24gaW4gY29udGV4dFxyXG4gKiBhcHBseVZhbHVlKGh0bWxJbnB1dCwgZnVuY3Rpb24ob2JqKXt0aGlzLnZhbHVlID0gb2JqLmZpcnN0TmFtZSArICcgJyArIG9iai5sYXN0TmFtZX0sIG15T2JqZWN0KTtcclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IHRhcmdldFNvdXJjZSBBbnkgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIHRhcmdldCBwYXRoXHJcbiAqIEBwYXJhbSB7c3RyaW5nIHwgZnVuY3Rpb259IHBhdGggQ2FuIGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgQW55IHZhbHVlIHRvIGFwcGx5LiAgSWYgdGhlIHBhdGggaXMgYSBmdW5jdGlvbiBhbmQgdGhlXHJcbiAqIHZhbHVlIGlzIGFuIGFycmF5LCBlYWNoIGVsZW1lbnQgaXMgcGFzc2VkIGFzIGFuIGFyZ3VtZW50LlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5VmFsdWUodGFyZ2V0U291cmNlLCBwYXRoLCB2YWx1ZSkge1xyXG4gICAgY29uc3Qgc2ltcGxlID0gdHlwZW9mIHBhdGggIT09ICdzdHJpbmcnIHx8IHBhdGguaW5kZXhPZignLicpID09PSAtMTtcclxuICAgIGxldCB0YXJnZXQgPSB0YXJnZXRTb3VyY2U7XHJcbiAgICBsZXQgY29udGV4dDtcclxuICAgIC8vIENoZWNrIGZvciBkZWVwIG9iamVjdCByZWZlcmVuY2VzXHJcbiAgICBpZiAoIXNpbXBsZSkge1xyXG4gICAgICAgIGNvbnN0IHBhdGhzID0gcGF0aC5zcGxpdCgnLicpO1xyXG4gICAgICAgIGNvbnN0IGxlbiA9IH5+cGF0aHMubGVuZ3RoO1xyXG4gICAgICAgIGxldCBpID0gfn4wO1xyXG4gICAgICAgIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gcGF0aHNbaV07XHJcbiAgICAgICAgICAgIGNvbnRleHQgPSB0YXJnZXQ7XHJcbiAgICAgICAgICAgIGlmIChpICE9PSBsZW4pIHtcclxuICAgICAgICAgICAgICAgIHRhcmdldCA9IGNvbnRleHRbZnJhZ21lbnRdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gQ2hlY2sgZm9yIG1lbWJlciBwcm9wZXJ0aWVzXHJcbiAgICBlbHNlIGlmICh0eXBlb2YgcGF0aCA9PT0gJ2Z1bmN0aW9uJyAmJiBwYXRoIGluIHRhcmdldFNvdXJjZSkge1xyXG4gICAgICAgIHRhcmdldCA9IHRhcmdldFNvdXJjZVtwYXRoXTtcclxuICAgICAgICBjb250ZXh0ID0gdGFyZ2V0U291cmNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENhbGwgZnVuY3Rpb24gaW4gb3VyIHRhcmdldCdzIGNvbnRleHRcclxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgLy8gRmFzdGVyIHRoYW4gdmFsdWUgaW5zdGFuY2VvZiBBcnJheVxyXG4gICAgICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS5zcGxpY2UpIHtcclxuICAgICAgICAgICAgdGFyZ2V0LmFwcGx5KGNvbnRleHQsIHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRhcmdldC5jYWxsKGNvbnRleHQsIHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICB0YXJnZXRTb3VyY2VbcGF0aF0gPSB2YWx1ZTtcclxuICAgIH1cclxufVxyXG5cclxubGV0IGNoYW5nZXNCeU9iamVjdCA9IG5ldyBNYXAoKTtcclxubGV0IHF1ZXVlID0gbmV3IFNldCgpO1xyXG5cclxubGV0IG5leHRGcmFtZUlkO1xyXG5cclxuLyoqXHJcbiAqIEZ1bmN0aW9uIHVzZWQgdG8gcHJvY2VzcyBwcm9wZXJ0eSBjaGFuZ2VcclxuICogbm90aWZpY2F0aW9ucyBieSBwb29saW5nIGFuZCB0aGVuIGV4ZWN1dGluZ1xyXG4gKiB0aGUgbm90aWZpY2F0aW9uIGNoYW5nZUxpc3RlbmVycyBvbiB0aGUgbmV4dCB0aWNrLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIFRoZSBvd25lciBvZiB0aGUgcHJvcGVydHkgYmVpbmcgY2hhbmdlZFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlOYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGhhcyBjaGFuZ2VkXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvbGRWYWx1ZSBUaGUgdmFsdWUgcHJpb3IgdG8gdGhlIGNoYW5nZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gbmV3VmFsdWUgVGhlIHZhbHVlIGFmdGVyIHRoZSBjaGFuZ2VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBxdWV1ZU5vdGlmaWNhdGlvbihzb3VyY2UsIHByb3BlcnR5TmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XHJcbiAgICBpZiAob2xkVmFsdWUgPT09IG5ld1ZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgbGV0IGluZm8gPSBjaGFuZ2VzQnlPYmplY3QuZ2V0KHNvdXJjZSk7XHJcblxyXG4gICAgaWYgKGluZm8gPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIGluZm8gPSB7XHJcbiAgICAgICAgICAgIHNvdXJjZTogc291cmNlLFxyXG4gICAgICAgICAgICBjaGFuZ2VzOiB7fVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgY2hhbmdlc0J5T2JqZWN0LnNldChzb3VyY2UsIGluZm8pO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY2hhbmdlcyA9IGluZm8uY2hhbmdlcztcclxuXHJcbiAgICBjaGFuZ2VzW3Byb3BlcnR5TmFtZV0gPSB7b2xkVmFsdWUsIG5ld1ZhbHVlfTtcclxuICAgIHF1ZXVlLmFkZChzb3VyY2UpO1xyXG4gICAgaWYgKG5leHRGcmFtZUlkKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIG5leHRGcmFtZUlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcclxuICAgICAgICBjb25zdCBwcm9jZXNzaW5nUXVldWUgPSBxdWV1ZTtcclxuICAgICAgICBjb25zdCBwcm9jZXNzaW5nQ2hhbmdlcyA9IGNoYW5nZXNCeU9iamVjdDtcclxuICAgICAgICBxdWV1ZSA9IG5ldyBTZXQoKTtcclxuICAgICAgICBjaGFuZ2VzQnlPYmplY3QgPSBuZXcgTWFwKCk7XHJcbiAgICAgICAgbmV4dEZyYW1lSWQgPSBudWxsOyAvLyBudWxsaWZ5IHRvIGVuYWJsZSBxdWV1aW5nIGFnYWluXHJcblxyXG4gICAgICAgIHByb2Nlc3NpbmdRdWV1ZS5mb3JFYWNoKHNvdXJjZSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHtjaGFuZ2VzfSA9IHByb2Nlc3NpbmdDaGFuZ2VzLmdldChzb3VyY2UpO1xyXG4gICAgICAgICAgICBub3RpZnkoc291cmNlLCBjaGFuZ2VzKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWl4aW5Ob3RpZmllcihwcm90b3R5cGUpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHByb3RvdHlwZSwge1xyXG4gICAgICAgIGNoYW5nZUxpc3RlbmVyczoge1xyXG4gICAgICAgICAgICBnZXQ6IGdldENoYW5nZUxpc3RlbmVyc1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHByZUNvbW1pdExpc3RlbmVyczoge1xyXG4gICAgICAgICAgICBnZXQ6IGdldFByZUNvbW1pdExpc3RlbmVyc1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYWRkQ2hhbmdlTGlzdGVuZXI6IHt2YWx1ZTogYWRkQ2hhbmdlTGlzdGVuZXJ9LFxyXG4gICAgICAgIHJlbW92ZUNoYW5nZUxpc3RlbmVyOiB7dmFsdWU6IHJlbW92ZUNoYW5nZUxpc3RlbmVyfSxcclxuICAgICAgICBhZGRQcmVDb21taXRMaXN0ZW5lcjoge3ZhbHVlOiBhZGRQcmVDb21taXRMaXN0ZW5lcn0sXHJcbiAgICAgICAgcmVtb3ZlUHJlQ29tbWl0TGlzdGVuZXI6IHt2YWx1ZTogcmVtb3ZlUHJlQ29tbWl0TGlzdGVuZXJ9LFxyXG4gICAgICAgIHN1c3BlbmROb3RpZmljYXRpb25zOiB7dmFsdWU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZX1cclxuICAgIH0pO1xyXG59XHJcblxyXG4vKipcclxuICogTm90aWZpZXMgYWxsIGNoYW5nZUxpc3RlbmVycyB0aGF0IGEgcHJvcGVydHkgaGFzIGNoYW5nZWQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIG93bmVyIG9mIHRoZSBwcm9wZXJ0eVxyXG4gKiBAcGFyYW0ge09iamVjdH0gY2hhbmdlcyBUaGUgZGV0YWlscyBvZiBwcm9wZXJ0eSBjaGFuZ2VzIHRoYXRcclxuICogb2NjdXJyZWQgb24gdGhlIGNvbnRleHRcclxuICovXHJcbmZ1bmN0aW9uIG5vdGlmeShzb3VyY2UsIGNoYW5nZXMpIHtcclxuICAgIHNvdXJjZS5jaGFuZ2VMaXN0ZW5lcnMuZm9yRWFjaChjYWxsYmFjayA9PiB7XHJcbiAgICAgICAgY2FsbGJhY2soc291cmNlLCBjaGFuZ2VzKTtcclxuICAgIH0pO1xyXG59XHJcbiIsImltcG9ydCB7bWl4aW5Ob3RpZmllciwgcXVldWVOb3RpZmljYXRpb24sIGdldENoYW5nZUxpc3RlbmVyc30gZnJvbSAnLi91dGlscyc7XHJcblxyXG5jb25zdCBhY3RpdmVCaW5kaW5ncyA9IG5ldyBXZWFrTWFwKCk7XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVHZXR0ZXIocHJvcGVydHkpIHtcclxuXHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xyXG4gICAgICAgIHJldHVybiBnZXRQcm9wZXJ0eVZhbHVlcyhzZWxmKVtwcm9wZXJ0eV07XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVNldHRlcihwcm9wZXJ0eSwgZGVzY3JpcHRvcikge1xyXG5cclxuICAgIHJldHVybiBmdW5jdGlvbiAobmV3VmFsdWUpIHtcclxuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcclxuICAgICAgICBjb25zdCBzdXNwZW5kTm90aWZpY2F0aW9ucyA9IHNlbGYuc3VzcGVuZE5vdGlmaWNhdGlvbnM7XHJcbiAgICAgICAgbGV0IHZhbHVlID0gZ2V0UHJvcGVydHlWYWx1ZXMoc2VsZilbcHJvcGVydHldO1xyXG4gICAgICAgIC8vIEhvbm9yIGFuIGV4aXN0aW5nIHNldHRlciBpZiBhbnlcclxuICAgICAgICBpZiAodHlwZW9mIGRlc2NyaXB0b3Iuc2V0ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGRlc2NyaXB0b3Iuc2V0LmNhbGwoc2VsZiwgbmV3VmFsdWUpO1xyXG4gICAgICAgICAgICAvLyBNdXRhdGlvbnM/IENhc3RzP1xyXG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvci5nZXQpIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gZGVzY3JpcHRvci5nZXQuY2FsbChzZWxmKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHZhbHVlO1xyXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbmV3VmFsdWUgfHwgbm90aWZ5UHJlQ29tbWl0KHNlbGYsIHtbcHJvcGVydHldOiB7b2xkVmFsdWUsIG5ld1ZhbHVlfX0pKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFsdWUgPSBuZXdWYWx1ZTtcclxuICAgICAgICBpZiAoc3VzcGVuZE5vdGlmaWNhdGlvbnMgPT09IGZhbHNlICYmICFnZXRDaGFuZ2VMaXN0ZW5lcnMuY2FsbChzZWxmKS52YWx1ZXMoKS5uZXh0KCkuZG9uZSkge1xyXG4gICAgICAgICAgICBxdWV1ZU5vdGlmaWNhdGlvbihzZWxmLCBwcm9wZXJ0eSwgb2xkVmFsdWUsIG5ld1ZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZ2V0UHJvcGVydHlWYWx1ZXMoc2VsZilbcHJvcGVydHldID0gdmFsdWU7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFByb3BlcnR5VmFsdWVzKGNvbnRleHQpIHtcclxuICAgIGlmIChhY3RpdmVCaW5kaW5ncy5oYXMoY29udGV4dCkpIHtcclxuICAgICAgICByZXR1cm4gYWN0aXZlQmluZGluZ3MuZ2V0KGNvbnRleHQpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgdmFsdWVzID0ge307XHJcbiAgICBhY3RpdmVCaW5kaW5ncy5zZXQoY29udGV4dCwgdmFsdWVzKTtcclxuICAgIHJldHVybiB2YWx1ZXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vdGlmeVByZUNvbW1pdChzb3VyY2UsIGNoYW5nZXMpIHtcclxuICAgIGxldCBjYW5jZWxlZCA9IGZhbHNlO1xyXG4gICAgc291cmNlLnByZUNvbW1pdExpc3RlbmVycy5mb3JFYWNoKHByZUNvbW1pdENhbGxiYWNrID0+IHtcclxuICAgICAgICBjYW5jZWxlZCA9IChwcmVDb21taXRDYWxsYmFjayhzb3VyY2UsIGNoYW5nZXMsIGNhbmNlbGVkKSA9PT0gZmFsc2UpIHx8IGNhbmNlbGVkO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gY2FuY2VsZWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTdHJ1Y3R1cmVzIHRoZSBwcm90b3R5cGUgdG8gZGVmaW5lIGEgYmluZGFibGUgcHJvcGVydHlcclxuICogb24gdGhlIGZpcnN0IHdyaXRlIHdoZW4gXCJ0aGlzXCIgaXMgYW4gaW5zdGFuY2Ugb2YgdGhlXHJcbiAqIGNsYXNzIG9yIHByb3RvdHlwZS5cclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5IFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byBiaW5kXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYmluZGFibGUocHJvcGVydHkpIHtcclxuICAgIHJldHVybiBjb25zdHJ1Y3RvciA9PiB7XHJcbiAgICAgICAgLy8gTWl4aW5cclxuICAgICAgICBjb25zdCBwcm90b3R5cGUgPSBjb25zdHJ1Y3Rvci5wcm90b3R5cGU7XHJcbiAgICAgICAgaWYgKCFhY3RpdmVCaW5kaW5ncy5oYXMocHJvdG90eXBlKSkge1xyXG4gICAgICAgICAgICBtaXhpbk5vdGlmaWVyKHByb3RvdHlwZSk7XHJcbiAgICAgICAgICAgIGFjdGl2ZUJpbmRpbmdzLnNldChwcm90b3R5cGUsIHRydWUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvdG90eXBlLCBwcm9wZXJ0eSkgfHwge307XHJcbiAgICAgICAgLy8gYWxyZWFkeSBib3VuZCAtIG5vdGhpbmcgdG8gZG9cclxuICAgICAgICBpZiAoYWN0aXZlQmluZGluZ3MuaGFzKGRlc2NyaXB0b3IuZ2V0KSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG90eXBlLCBwcm9wZXJ0eSwge1xyXG4gICAgICAgICAgICBnZXQ6IGRlc2NyaXB0b3IuZ2V0IHx8IGNyZWF0ZUdldHRlcihwcm9wZXJ0eSksXHJcbiAgICAgICAgICAgIHNldDogY3JlYXRlU2V0dGVyKHByb3BlcnR5LCBkZXNjcmlwdG9yKSxcclxuICAgICAgICAgICAgZW51bWVyYWJsZTogZGVzY3JpcHRvci5lbnVtZXJhYmxlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG59XHJcbiJdLCJuYW1lcyI6WyJjaGFuZ2VMaXN0ZW5lcnMiLCJXZWFrTWFwIiwicHJlQ29tbWl0TGlzdGVuZXJzIiwiZ2V0Q2hhbmdlTGlzdGVuZXJzIiwic2VsZiIsImhhcyIsImdldCIsImNhbGxiYWNrcyIsIlNldCIsInNldCIsImdldFByZUNvbW1pdExpc3RlbmVycyIsImFkZENoYW5nZUxpc3RlbmVyIiwiY2FsbGJhY2siLCJjYWxsIiwiYWRkIiwicmVtb3ZlQ2hhbmdlTGlzdGVuZXIiLCJkZWxldGUiLCJhZGRQcmVDb21taXRMaXN0ZW5lciIsInJlbW92ZVByZUNvbW1pdExpc3RlbmVyIiwiY2hhbmdlc0J5T2JqZWN0IiwiTWFwIiwicXVldWUiLCJuZXh0RnJhbWVJZCIsInF1ZXVlTm90aWZpY2F0aW9uIiwic291cmNlIiwicHJvcGVydHlOYW1lIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsImluZm8iLCJ1bmRlZmluZWQiLCJjaGFuZ2VzIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwicHJvY2Vzc2luZ1F1ZXVlIiwicHJvY2Vzc2luZ0NoYW5nZXMiLCJmb3JFYWNoIiwibWl4aW5Ob3RpZmllciIsInByb3RvdHlwZSIsImRlZmluZVByb3BlcnRpZXMiLCJ2YWx1ZSIsIndyaXRhYmxlIiwibm90aWZ5IiwiYWN0aXZlQmluZGluZ3MiLCJjcmVhdGVHZXR0ZXIiLCJwcm9wZXJ0eSIsImdldFByb3BlcnR5VmFsdWVzIiwiY3JlYXRlU2V0dGVyIiwiZGVzY3JpcHRvciIsInN1c3BlbmROb3RpZmljYXRpb25zIiwibm90aWZ5UHJlQ29tbWl0IiwidmFsdWVzIiwibmV4dCIsImRvbmUiLCJjb250ZXh0IiwiY2FuY2VsZWQiLCJwcmVDb21taXRDYWxsYmFjayIsImJpbmRhYmxlIiwiY29uc3RydWN0b3IiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJkZWZpbmVQcm9wZXJ0eSIsImVudW1lcmFibGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQU1BLGtCQUFrQixJQUFJQyxPQUFKLEVBQXhCO0FBQ0EsSUFBTUMscUJBQXFCLElBQUlELE9BQUosRUFBM0I7Ozs7Ozs7QUFPQSxBQUFPLFNBQVNFLGtCQUFULEdBQThCO1FBQzNCQyxPQUFPLElBQWI7UUFDSUosZ0JBQWdCSyxHQUFoQixDQUFvQkQsSUFBcEIsQ0FBSixFQUErQjtlQUNwQkosZ0JBQWdCTSxHQUFoQixDQUFvQkYsSUFBcEIsQ0FBUDs7UUFFRUcsWUFBWSxJQUFJQyxHQUFKLEVBQWxCO29CQUNnQkMsR0FBaEIsQ0FBb0JMLElBQXBCLEVBQTBCRyxTQUExQjs7V0FFT0EsU0FBUDs7Ozs7Ozs7O0FBU0osQUFBTyxTQUFTRyxxQkFBVCxHQUFpQztRQUM5Qk4sT0FBTyxJQUFiO1FBQ0lGLG1CQUFtQkcsR0FBbkIsQ0FBdUJELElBQXZCLENBQUosRUFBa0M7ZUFDdkJGLG1CQUFtQkksR0FBbkIsQ0FBdUJGLElBQXZCLENBQVA7O1FBRUVHLFlBQVksSUFBSUMsR0FBSixFQUFsQjt1QkFDbUJDLEdBQW5CLENBQXVCTCxJQUF2QixFQUE2QkcsU0FBN0I7O1dBRU9BLFNBQVA7Ozs7Ozs7O0FBUUosQUFBTyxTQUFTSSxpQkFBVCxDQUEyQkMsUUFBM0IsRUFB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
