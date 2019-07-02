Tasks can be made into plugins in order to allow reuse and quick development. To install a plugin, follow these steps:

  1. Install the plugin through NPM: `npm install ease-task-pluginname --save-dev` (replace `pluginname` with the name of the plugin)
  2. Use the `install()` method to install and configure the plugin:
      ```js
      const sass = require('ease-task-sass');

      module.exports = ease => {

        // Install the plugin as `sass` task
        ease.install('sass', sass, { dir: 'sass', ourDir: 'css', sourceMap: true });

        // Use the task in a job
        ease.job('process-sass-files', ['sass']);

      };
      ```
