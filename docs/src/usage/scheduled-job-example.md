```js
module.exports = ease => {

  ease.task('task1', () => ease.log('Running task 1'));

  // Schedule job to run every Monday at 5 in the afternoon
  ease.job('job1', ['task1'], {
    runImmediately: false,
    schedule: {
      recurrence: 'weekly',
      day: 1,
      time: '17:00:00'
    }
  });

};
```
