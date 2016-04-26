# bind-property
A small javascript library for enabling bindable properties. Although property changes are immediately available on the source object, notifications are queued via raf to prevent thrashing and increase performance.

## Use
### As a Decorator
Using a transpiler that supports [ES6 decorators](https://github.com/wycats/javascript-decorators):
```js
import { bindable, bindInstanceProperty } from 'bind-property';

@bindable('firstName');
@bindable('lastName');
class Person{
    
    @bindInstanceProperty // Nope - babel cannot decorate class properties.
    gender = null;
    
    constructor(){
    
    }
    
    @bindInstanceProperty // OK
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
    console.log(changes); // {firstName: {oldValue: null, newValue: "Johnnie"}, lastName: {oldValue: null, newValue: "Walker"}}
});
//...
person.firstName = "Johnnie";
person.lastName = "Walker";
```
