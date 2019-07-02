Ease looks for a configuration file named `easeconfig.js` inside the current working directory for task and job definitions. The configuration file must export a function which accepts the `ease` object as its parameter, which can be used to define tasks, jobs, schedules, etc.

```js
module.exports = ease => {

  // Use the ease object here

};
```
