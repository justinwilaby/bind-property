# bind-property
A small javascript library for enabling bindable properties. Property changes are immediately available on the source object after a change is made but notifications are queued via raf to prevent thrashing and increase performance.

## Basic Usage
### As a Decorator
Using a transpiler that supports [ES6 decorators](https://github.com/wycats/javascript-decorators) and a browser that supports [WeakMap](http://kangax.github.io/compat-table/es6/#test-WeakMap) and [Set](http://kangax.github.io/compat-table/es6/#test-Set):
```js
import { bindable } from 'bind-property';

@bindable('firstName')
@bindable('lastName')
@bindable('age') // Setters are bindable
class Person {
    
    gender;
    firstName;
    lastName;
    
    get age(){
        return this._age;
    }
    
    set age(value){
        this._age = value;
    }
}
//...
const person = new Person();
person.addChangeListener(function (source, changes){
    console.log(changes); // {firstName: {oldValue: null, newValue: "Johnnie"}, lastName: {oldValue: null, newValue: "Walker"}, gender: {oldValue:null, newValue: "Male"}}
});
//...
person.firstName = "Johnnie";
person.lastName = "Walker";
person.gender = "Male"
```
#API
###Defining at least one property as bindable will cause the class prototype to adopt the binding APIs.
#Properties

#Methods
##bindable()
The **bindable** decorator is used to designate a property as bindable.  When a property is binable, all instances of the class will track property changes and provide mechanisms for subscribing to receive notifications when values are changed.
```js
import { binable } from 'bind-property';
@bindable('data')
class BinableClass{
    constructor(data){
        this.data = data;
    }
}
```
### bindable() Syntax

```js
@bindable(propertyName)
```
### Parameters
**propertyName**
Required. The name of the property to make bindable.  If the prototype of the class does not contain the property specified, it is created.  If a default value for the property exists in the prototype, it will be honored.  Once a property is defined as bindable, subsequent changes to it's value will trigger a notification if at least once change listener has been added.

##addChangeListener()
Required. The **addChangeListener()** method registers a callback to receive a notification of a property change on a class where at least 1 property is defined as bindable using the `@bindable` decorator.
###addChangeListener() Syntax
```js
bindableClassInstance.addChangeListener(callback);
```
### Parameters
**callback**  
Required. The function to invoke when a bindable property has changed.  Adding the same callback more than once will not result in the callback being invoked multiple times for the same notification cycle.  Callbacks are invoked in the order in which they are added.
`callback` is invoked with **two arguments**:
1. The `source` object upon which the property has changed.
2. The `changes` object which contains keys representing the name of the property that has changed and values which contains the old and new values of the property. e.g. `{propertyName: {oldValue: theOldValue, newValue: theNewValue}`.
###Example
```js
import { binable } from 'bind-property';
@bindable('name')
class Person {
    name;
    
    constructor(name){
        this.name = name;
    }
}
const person = new Person('Jack Black');

const propertyChangeHandler = (source, changes) => {
    console.log(changes); // {name: {oldValue: "Jack Black", newValue: "Tom Thumb"}}
};

person.addChangeListener(propertyChangeHandler);
person.name = 'Tom Thumb';
```
##removeChangeListener()
The **removeChangeListener** method removes a callback that was previously added using `addChangeListener`
###removeChangeListener() Syntax
```js
bindableClassInstance.removeChangeListener(callback);
```
###Parameters
**callback**  
Required. The function to remove.

##addPreCommitListener()
The **addPreCommitListener** method is used to register functions that are invoked before a property change has been committed.  If the function returns `false`, the property change is not made and notifications are canceled.
###addPreCommitListener() Syntax
```js
bindableClassInstance.addPreCommitListener(callback);
```
###Parameters
**callback**  
Required. The function to add that is invoked when the value of a binable property is about to change. 
`callback` is invoked with **three arguments**:
1. The `source` object upon which the property will change.
2. The `changes` object which contains keys representing the name of the property(s) that will change and values which contains the old and new values of the property. e.g. `{propertyName: {oldValue: theOldValue, newValue: theNewValue}`.
3. `canceled` boolean.  This flag is `true` when more than **one function is added** via `preCommitListener()` and at least one of those calls resulted in a canceled property change.
## Example
```js
import { binable } from 'bind-property';
@bindable('name')
class Person {
    name;
    
    constructor(name){
        this.name = name;
    }
}
const person = new Person('Jack Black');

const propertyChangeHandler = (source, changes) => {
    // never called since the property 
    // change was canceled by the 
    // propertyPreCommitHandler
    console.log(changes); 
};

const propertyPreCommitHandler = (source, changes, canceled) =>{
    if ('name' in changes){
        return false;
    }
    return true;
};
person.addChangeListener(propertyChangeHandler);
person.addPreCommitListener(propertyPreCommitHandler);
person.name = 'Tom Thumb';

```
##removePreCommitListener()
The **removePreCommitListener** removes a callback that was previously added using `addPreCommitListener`
###removePreCommitListener() Syntax
```js
bindableClassInstance.removePreCommitListener(callback);
```
###Parameters
**callback**  
Required. The function to remove.

#Properties
##changeListeners
Read-only - an array containing all change listeners added by `addChangeListener`

##preCommitListeners
Read-only - an array containing all pre commit listeners added by `addPreCommitListener`

##suspendNotifications
When `true`, property change notifications are suspended and callbacks added using `addChangeListener` are not notified of property changes.  Note that callbacks added using `addPrecommitListener` are not affected.