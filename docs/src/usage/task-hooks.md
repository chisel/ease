The following hooks are available for all tasks which will be defined when appended to the task name in the `ease.task()` method:
  - `:before`: Runs before the task and can suspend the task from running using the `suspend` method in the callback arguments. Can be asynchronous if the callback returns a promise.
  - `:after`: Runs after the task. Can be asynchronous if the callback returns a promise.
  - `:suspend`: Runs after the task was suspended. Can be asynchronous if the callback returns a promise.
  - `:error`: Runs after an error has occurred in the task or any of its hooks. Can be asynchronous if the callback returns a promise.

```js
module.exports = ease => {

  ease.task('foo:before', (jobName, suspend) => {

    ease.log('Running before task foo...');

  });

  ease.task('foo', jobName => {

    // Do stuff

  });

  ease.task('foo:error', (jobName, error) => {

    ease.log('Task foo has failed:\n' + error);

  });

};
```
