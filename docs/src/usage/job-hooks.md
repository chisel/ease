Jobs have hooks identical to tasks and are defined using the `ease.hook()` method, the only difference is the callback arguments in which the `jobName` is not provided.

```js
module.exports = ease => {

  ease.task('foo', jobName => ease.log('Running foo...'));

  ease.job('job1', ['foo']);

  ease.hook('job1:after', () => ease.log('Job1 has finished.'));

};
```
