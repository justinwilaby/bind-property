let rollingCount = ~~0;
export function getNextId() {
    return rollingCount++;
}
/**
 * The PropertyChangeNotifier is a base class that
 * provides a sub/pub mechanism for property change notifications
 * on the class that extends it.
 * Property changes are queued and any subscribers are
 * notified on the next frame in order to increase the
 * likeliness of data stability when numerous properties
 * change in a single call stack.
 */
export class PropertyChangeNotifier {

    /**
     * The callbacks listening for
     * property changes
     *
     * @memberof PropertyChangeNotifier#
     * @var {Array<function>} callbacks
     */

    /**
     * Flag indicating whether or not all notifications
     * should be suspended.
     *
     * @memberof PropertyChangeNotifier#
     * @var {boolean} suspendNotifications
     * @default false
     */

    constructor() {
        Object.defineProperties(this, {
            suspendNotifications: {value: false, enumerable: true},
            callbacks: {value: [], enumerable: true}
        });
    }

    /**
     * Adds a function as a change listener.
     * The callback will be provided
     *
     * @param {function} callback The callback that is notified of property changes.
     */
    addChangeListener(callback) {
        const self = this;
        const callbacks = self.callbacks;
        const index = callbacks.indexOf(callback);
        if (index === -1) {
            callbacks.push(callback);
        }
    }

    /**
     * Removes a callback that has been previously added
     *
     * @param {function} callback The callback to remove
     */
    removeChangeListener(callback) {
        const self = this;
        const callbacks = self.callbacks;
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }
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

let changesByBindingId = [];
let nextFrameId;

/**
 * Function used to process property change
 * notifications by pooling and then executing
 * the notification callbacks on the next tick.
 *
 * @param {int} bindingId The unique id of the bound property that changed
 * @param {Object} source The owner of the property being changed
 * @param {String} propertyName The name of the property that has changed
 * @param {Object} oldValue The value prior to the change
 * @param {Object} newValue The value after the change
 */
export function queueNotification(bindingId, source, propertyName, oldValue, newValue) {
    if (oldValue === newValue) {
        return;
    }
    let info = changesByBindingId[bindingId];

    if (info === undefined) {
        info = changesByBindingId[bindingId] = {
            source: source,
            changes: {}
        };
    }
    const changes = info.changes;

    changes[propertyName] = {
        oldValue: oldValue,
        newValue: newValue
    };

    if (nextFrameId) {
        return;
    }

    nextFrameId = requestAnimationFrame(function () {
        let queue = changesByBindingId; // retain a reference for processing
        // additional property changes queued on next cycle
        changesByBindingId = [];
        nextFrameId = null; // nullify to enable queuing again
        // sparse - for in required
        for (let bindingId in queue) {
            const cursor = queue[bindingId];
            notify(cursor.source, cursor.changes);
        }
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
    const len = callbacks.length;
    let i = 0;
    for (; ~~i < ~~len; i++) {
        callbacks[i](source, changes);
    }
}
