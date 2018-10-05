import {
  buildPriorityQueue,
  getChangeListeners,
  getPreCommitListeners,
  getPriorityQueue,
  mixinNotifier,
  queueNotification
} from './utils';

const propertyValues = new WeakMap();

function notifyPreCommit(source, changes) {
  let canceled = false;
  const queue = getPriorityQueue(source, 'preCommitPriorityQueue');
  if (queue.length === 0) {
    buildPriorityQueue(getPreCommitListeners.call(source), queue);
  }
  queue.forEach(function (item) {
    canceled = ( item.callback(source, changes, canceled, item.priority) === false ) || canceled;
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
export function bindable(descriptor) {
  descriptor.finisher = function (clazz) {
    // Mixin
    mixinNotifier(clazz.prototype);
  };
  const {key} = descriptor;
  descriptor.kind = 'method';
  descriptor.placement = 'prototype';
  descriptor.descriptor = ( function (initializer = () => null, propertyDescriptor = {}, property) {
    return {
      get: ( propertyDescriptor.get || function () {
        return getValuesMap.call(this, property, initializer)[ property ];
      } ),
      set: function (newValue) {
        const self = this;
        const suspendNotifications = self.suspendNotifications;
        const valuesMap = getValuesMap.call(this, property, initializer);
        const oldValue = valuesMap[ property ];
        let value;
        // Honor an existing setter if any
        if (typeof propertyDescriptor.set === 'function') {
          propertyDescriptor.set.call(self, newValue);
          // Mutations? Casts?
          if (propertyDescriptor.get) {
            value = propertyDescriptor.get.call(self);
          }
        }
        if (value === newValue || notifyPreCommit(self, {[ property ]: {oldValue, newValue}})) {
          return;
        }
        valuesMap[property] = newValue;
        if (suspendNotifications === false && !getChangeListeners.call(self).values().next().done) {
          queueNotification(self, property, oldValue, newValue);
        }
      },
      enumerable: propertyDescriptor.enumerable !== undefined ? propertyDescriptor.enumerable : true
    }
  } )(descriptor.initializer, descriptor.descriptor, key);

  delete descriptor.initializer;
  return descriptor;
}

function getValuesMap(property, initializer) {
  let valuesMap = propertyValues.get(this);
  if (!valuesMap) {
    valuesMap = {[ property ]: initializer()};
    propertyValues.set(this, valuesMap);
  }
  return valuesMap;
}

export { queueNotification };
