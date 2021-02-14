Ease looks for a configuration file named `easeconfig.js` or `easeconfig.ts` (in that exact order) inside the current working directory for task and job definitions. If the file was not found, it would look in the parent directories all the way up to the root.

The configuration file must export a function which takes the `ease` object as its parameter, which can be used to define tasks, jobs, schedules, etc.

easeconfig.js
```js
module.exports = ease => {

  // Use the ease object here

};
```

easeconfig.ts
```ts
import { Ease } from '@chisel/ease';

export default (ease: Ease) => {

  // Use the ease object here

};
```
