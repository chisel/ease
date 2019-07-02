To create an Ease plugin, write a module that exports a factory function which takes the following arguments and returns a task runner function:
  - `logger`: An instance of `ease.log()` which can be used to log messages.
  - `dirname`: The path to the directory where `easeconfig.js` is. Use this when constructing paths to make them relative to the config file.
  - `...args`: Any arguments provided by the user. This can be the input your plugin needs (config object, etc.)

Example:
```js
const fs = require('fs-extra');
const path = require('path');

module.exports = (logger, dirname, config) => {

  // Task runner
  return () => {

    // Async task
    return new Promise((resolve, reject) => {

      const finalPath = path.join(dirname, config.dir);

      logger(`Emptying "${finalPath}"...`);

      // Empty the directory's content
      fs.emptyDir(finalPath, error => {

        if ( error ) reject(error);
        else resolve();

      });

    });

  };

};
```

> When publishing Ease tasks, it's good practice to prefix the plugin name with `ease-task-`.
