import {mixinNotifier, queueNotification} from './utils';

const activeBindings = new WeakMap();

function createGetter(property) {

    return function () {
        const self = this;
        return getPropertyValues(self)[property];
    }
}

function createSetter(property, descriptor) {

    return function (newValue) {
        const self = this;
        let value = getPropertyValues(self)[property];
        // Honor an existing setter if any
        if (typeof descriptor.set === 'function') {
            descriptor.set.call(self, newValue);
            // Mutations? Casts?
            if (descriptor.get) {
                value = descriptor.get.call(self);
            }
        }
        const oldValue = value;
        if (value === newValue || notifyPreCommit(self, {[property]: {oldValue, newValue}})) {
            return;
        }
        value = newValue;
        if (self.suspendNotifications === false) {
            queueNotification(self, property, oldValue, newValue);
        }
        getPropertyValues(self)[property] = value;
    }
}

function getPropertyValues(context) {
    if (activeBindings.has(context)) {
        return activeBindings.get(context);
    }
    const values = {};
    activeBindings.set(context, values);
    return values;
}

function notifyPreCommit(source, changes) {
    let canceled = false;
    source.preCommitListeners.forEach(preCommitCallback => {
        canceled = (preCommitCallback(source, changes, canceled) === false) || canceled;
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
export function bindable(property) {
    return constructor => {
        // Mixin
        const prototype = constructor.prototype;
        if (!activeBindings.has(prototype)) {
            mixinNotifier(prototype);
            activeBindings.set(prototype, true);
        }

        const descriptor = Object.getOwnPropertyDescriptor(prototype, property) || {};
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
