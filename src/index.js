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
function bindClientInstance(context, property, descriptor, currentValue) {
    let getter = descriptor.get;
    // already bound - nothing to do
    if (activeBindings.has(getter)) {
        return activeBindings.get(getter);
    }

    // Use an existing getter if present
    if (!getter) {
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
export function bindable(prototype, property) {

    // Mixin
    if (!activeBindings.has(prototype)) {
        var notifier = new PropertyChangeNotifier();
        Object.assign(prototype, notifier);
        activeBindings.set(prototype, true);
    }

    const descriptor = {
        set: value => {
            bindClientInstance(this, property, descriptor, value);
        },
        configurable: true,
        enumerable: true
    };

    Object.defineProperty(prototype, property, descriptor);
}

export function bind(options, targetSource) {
    const notifier = activeBindings.get(targetSource) || new PropertyChangeNotifier();
    let bindingId;
    let property;
    let targetProperty;
    let interceptor;
    let inclusions = {};

    if (options && options.splice) {
        const len = options.length;
        let i = 0;
        for (; ~~i < ~~len; i++) {
            const thatOption = options[i];
            property = thatOption.property;
            targetProperty = thatOption.targetProperty;
            interceptor = thatOption.interceptor;
            bindingId = addBinding(notifier, thatOption.source, property);
            if (!inclusions[bindingId]) {
                inclusions[bindingId] = [];
            }
            inclusions[bindingId].push({property, targetProperty, interceptor});
        }
    }
    else {
        property = options.property;
        targetProperty = options.targetProperty;
        interceptor = options.interceptor;
        bindingId = addBinding(notifier, options.source, property);
        inclusions[bindingId] = [{property, targetProperty, interceptor}];
    }

    const notifierCallback = function (bindingId, dataSource, changes) {
        const infos = inclusions[bindingId];
        if (!infos) {
            return;
        }
        const len = infos.length;
        let i = 0;
        for (; ~~i < ~~len; i++) {
            const info = infos[i];
            const target = changes[info.property];
            let newValue = target.newValue;
            if (typeof info.interceptor === 'function') {
                newValue = info.interceptor(targetSource, info.targetProperty, newValue, target.oldValue);
            }
            applyValue(targetSource, info.targetProperty, newValue);
        }
    };
    notifier.addCallback(notifierCallback);

    activeBindings.set(targetSource, notifier);

    return notifier.id;
}
