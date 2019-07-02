<div style="display: flex; width: 100%; justify-content: center;">
  <img src="./docs/images/logo.svg" style="width: 350px; height: 350px;">
</div>

# Ease Task Runner

Ease is a minimal task runner with scheduling capabilities designed to be flexible and easy to work with.

# Installation

```
npm install @chisel/ease -g
```

# Quick Start

1. Create the following file in project root:

  **easeconfig.js:**
  ```js
  module.exports = ease => {
    ease.task('task1', () => {
      // Perform task
    });
    ease.job('job1', ['task1']);
  };
  ```
2. Run `job1` through the CLI command: `ease job1`
3. Read the [official documentation](https://ease.js.org) to learn how to schedule jobs, install/create plugins, and all the other benefits Ease has to offer.
