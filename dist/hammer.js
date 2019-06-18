"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const request_1 = __importDefault(require("request"));
class Hammer {
    constructor(_verbose) {
        this._verbose = _verbose;
        this.jobs = {};
        this.tasks = {};
        fs_extra_1.default.ensureFileSync(path_1.default.join(os_1.default.homedir(), '.hammer', 'hammer.log'));
    }
    _parseName(name) {
        const components = name.split(':');
        return {
            name: components[0].toLowerCase(),
            hook: components[1] ? components[1].toLowerCase() : undefined
        };
    }
    _logToFile(message) {
        fs_extra_1.default.appendFileSync(path_1.default.join(os_1.default.homedir(), '.hammer', 'hammer.log'), message + '\n');
    }
    _log(message) {
        console.log(`[HAMMER] ${message}`);
        this._logToFile(`[HAMMER] ${message}`);
    }
    _logError(message) {
        console.log(chalk_1.default.bold.redBright(`[ERROR] ${message}`));
        this._logToFile(`[ERROR] ${message}`);
    }
    _logWarning(message) {
        console.log(chalk_1.default.bold.yellowBright(`[WARNING] ${message}`));
        this._logToFile(`[WARNING] ${message}`);
    }
    _logConfig(message) {
        if (this._verbose)
            console.log(chalk_1.default.bold.greenBright(`[CONFIG] ${message}`));
        this._logToFile(`[CONFIG] ${message}`);
    }
    task(name, task) {
        const parsed = this._parseName(name);
        if (parsed.hook && (parsed.hook !== 'before' && parsed.hook !== 'after')) {
            this._logError(`Unsupported hook name "${parsed.hook}" for task "${parsed.name}"`);
            throw new Error(`Unsupported hook name "${parsed.hook}" for task "${parsed.name}"`);
        }
        if (!this.tasks[parsed.name]) {
            this.tasks[parsed.name] = {
                name: parsed.name,
                suspended: false
            };
        }
        if (parsed.hook === 'before') {
            this._logConfig(`Registering before hook for task "${parsed.name}"`);
            this.tasks[parsed.name].beforeHook = task;
        }
        else if (parsed.hook === 'after') {
            this._logConfig(`Registering after hook for task "${parsed.name}"`);
            this.tasks[parsed.name].afterHook = task;
        }
        else {
            this._logConfig(`Registering task "${parsed.name}"`);
            this.tasks[parsed.name].runner = task;
        }
    }
    job(name, tasks) {
        const parsed = this._parseName(name);
        if (!tasks || !tasks.length) {
            this._logError(`Job "${parsed.name}" must have at least one task!`);
            throw new Error(`Job "${parsed.name}" must have at least one task!`);
        }
        for (const taskName of tasks) {
            if (!this.tasks[taskName]) {
                this._logError(`Task "${taskName}" not found!`);
                throw new Error(`Task "${taskName}" not found!`);
            }
            if (!this.tasks[taskName].runner) {
                this._logError(`Task "${taskName}" does not have a definition!`);
                throw new Error(`Task "${taskName}" does not have a definition!`);
            }
        }
        this._logConfig(`Registering job "${parsed.name}" with tasks ${tasks.map(task => `"${task}"`).join(', ')}`);
        this.jobs[parsed.name] = {
            name: parsed.name,
            tasks: tasks,
            suspended: false
        };
    }
    log(message) {
        console.log(chalk_1.default.cyanBright(`[LOG] ${message}`));
        this._logToFile(`[LOG] ${message}`);
    }
    suspend(jobName) {
        if (!this.jobs[jobName]) {
            this._logError(`Cannot suspend job "${jobName}" because it doesn't exist!`);
            throw new Error(`Cannot suspend job "${jobName}" because it doesn't exist!`);
        }
        this.jobs[jobName].suspended = true;
    }
    request(options) {
        return new Promise((resolve, reject) => {
            request_1.default(options, (error, response) => {
                if (error)
                    return reject(error);
                if (response.headers['content-type'] && response.headers['content-type'].toLowerCase() === 'application/json') {
                    try {
                        response.body = JSON.parse(response.body);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse response body!\n' + error.message));
                    }
                }
                resolve(response);
            });
        });
    }
    async _execJob(jobName) {
        if (!this.jobs[jobName]) {
            this._logError(`Job "${jobName}" not found!`);
            throw new Error(`Job "${jobName}" not found!`);
        }
        this._log(`Executing job "${jobName}"...`);
        const job = this.jobs[jobName];
        for (const taskName of job.tasks) {
            const task = this.tasks[taskName];
            if (!task.runner) {
                this._logError(`Task "${taskName}" does not have a definition!`);
                throw new Error(`Task "${taskName}" does not have a definition!`);
            }
            if (task.beforeHook) {
                this._log(`Running before hook of task "${taskName}"...`);
                try {
                    await task.beforeHook(jobName, () => task.suspended = true);
                }
                catch (error) {
                    this._logError(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);
                    throw new Error(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);
                }
            }
            if (job.suspended) {
                this._logWarning(`Job "${jobName}" was suspended!`);
                return;
            }
            if (task.suspended) {
                this._logWarning(`Task "${taskName}" was suspended!`);
                continue;
            }
            this._log(`Running task "${taskName}"...`);
            try {
                await task.runner(jobName);
            }
            catch (error) {
                this._logError(`An error has occurred on task "${taskName}"!\n${error}`);
                throw new Error(`An error has occurred on task "${taskName}"!\n${error}`);
            }
            if (job.suspended) {
                this._logWarning(`Job "${jobName}" was suspended!`);
                return;
            }
            if (task.afterHook) {
                this._log(`Running after hook of task "${taskName}"...`);
                try {
                    await task.afterHook(jobName);
                }
                catch (error) {
                    this._logError(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);
                    throw new Error(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);
                }
            }
            if (job.suspended) {
                this._logWarning(`Job "${jobName}" was suspended!`);
                return;
            }
        }
        this._log(`Job "${jobName}" was executed successfully.`);
    }
}
exports.Hammer = Hammer;
