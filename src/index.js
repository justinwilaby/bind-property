import { getNextId, applyValue, queueNotification, PropertyChangeNotifier } from './utils';

export const activeBindings = new WeakMap();

/**
 * Defines a getter setter pair that executes a binding callback
 * on the specified notifier when the property has changed.
 *
 * @param {Object} context The Object or Class containing the property to bind
 * @param {String} property The name of the property to bind
 * @param {Object} descriptor The descriptor of the property to be bound
 * @param {Object} currentValue The current value of the property
 */
function bindInstanceProperty(context, property, descriptor, currentValue = undefined) {
    let getter = descriptor.get;
    // already bound - nothing to do
    if (activeBindings.has(getter)) {
        return activeBindings.get(getter);
    }

    // Use an existing getter if present
    if (!getter) {
        if (currentValue === undefined){
            currentValue = descriptor.value
        }
        getter = function () {
            return currentValue;
        };
    }

    const bindingId = getNextId();
    activeBindings.set(getter, bindingId);

    // Binding getter/setter pair
    Object.defineProperty(context, property, {
        get: getter,

        set: function (newValue) {
            // Honor an existing setter if any
            if (typeof descriptor.set === 'function') {
                descriptor.set(newValue);
                // Mutation?
                newValue = getter();
            }
            if (currentValue === newValue) {
                return;
            }
            const oldValue = currentValue;
            currentValue = newValue;

            if (context.suspendNotifications === false) {
                queueNotification(bindingId, context, property, oldValue, newValue);
            }
        },
        configurable: true,
        enumerable: descriptor.enumerable
    });
}

/**
 * Structures the prototype to define a bindable property
 * on the first write when "this" is an instance of the
 * class or prototype.
 *
 * @param {Object} prototype The Class prototype containing the property to bind
 * @param {String} property The name of the property to bind
 */
export function bindable(property) {

    return prototype =>{
        // Mixin
        if (!activeBindings.has(prototype)) {
            var notifier = new PropertyChangeNotifier();
            Object.assign(prototype, notifier);
            activeBindings.set(prototype, true);
        }

        const descriptor = {
            set: value => {
                bindInstanceProperty(this, property, descriptor, value);
            },
            configurable: true,
            enumerable: true
        };

        Object.defineProperty(prototype, property, descriptor);
    };
}
