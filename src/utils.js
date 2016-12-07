let rollingCount = ~~0;
export function getNextId() {
    return rollingCount++;
}
const callbackHash = new WeakMap();

/**
 * The callbacks listening for
 * property changes.
 *
 * @return Set
 */
export function getCallbacks() {
    const self = this;
    if (callbackHash.has(self)) {
        return callbackHash.get(self);
    }
    const callbacks = new Set();
    callbackHash.set(self, callbacks);

    return callbacks;
}

/**
 * Adds a function as a change listener.
 * The callback will be provided
 *
 * @param {function} callback The callback that is notified of property changes.
 */
export function addChangeListener(callback) {
    getCallbacks.call(this).add(callback);
}

/**
 * Removes a callback that has been previously added
 *
 * @param {function} callback The callback to remove
 */
export function removeChangeListener(callback) {
    getCallbacks.call(this).delete(callback);
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
        const len = paths.length;
        let i = 0;
        for (; ~~i < ~~len; i++) {
            let fragment = paths[i];
            context = target;
            if (i !== len) {
                target = context[fragment];
            }
        }
    }
    // Check for member properties
    else if (typeof path === 'function' && path in targetSource) {
        target = targetSource[path];
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
        targetSource[path] = value;
    }
}

let changesByObject = new Map();
let queue = new Set();

let nextFrameId;

/**
 * Function used to process property change
 * notifications by pooling and then executing
 * the notification callbacks on the next tick.
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

    changes[propertyName] = {
        oldValue: oldValue,
        newValue: newValue
    };
    queue.add(source);
    if (nextFrameId) {
        return;
    }

    nextFrameId = requestAnimationFrame(() => {
        const processingQueue = queue;
        const processingChanges = changesByObject;
        queue = new Set();
        changesByObject = new Map();
        nextFrameId = null; // nullify to enable queuing again

        processingQueue.forEach(source => {
            const changes = processingChanges.get(source);
            notify(source, changes);
        });
    });
}

/**
 * Notifies all callbacks that a property has changed.
 *
 * @param {Object} source The owner of the property
 * @param {Object} changes The details of property changes that
 * occurred on the context
 */
function notify(source, changes) {
    const callbacks = source.callbacks;
    [...callbacks].forEach(callback => {
        callback(source, changes);
    });
}
