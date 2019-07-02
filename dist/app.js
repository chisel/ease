#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = __importDefault(require("commander"));
const path_1 = __importDefault(require("path"));
const ease_1 = require("./ease");
// Define CLI
commander_1.default
    .version('1.1.2', '--version')
    .usage('[options] <jobs>')
    .option('-c, --config <path>', 'path to the ease config file')
    .option('-v --verbose', 'detailed console logs')
    .option('-a --all', 'run all jobs defined in the ease config file')
    .parse(process.argv);
// Set config path to default if not provided
commander_1.default.config = path_1.default.join(process.cwd(), commander_1.default.config || 'easeconfig.js');
// If no job names are provided
if (!commander_1.default.args.length && !commander_1.default.all)
    commander_1.default.help();
// Load the config
const config = require(commander_1.default.config);
const ease = new ease_1.Ease(commander_1.default.verbose, path_1.default.dirname(commander_1.default.config));
// Configure Ease
config(ease);
// Run the jobs
ease._execJobs(commander_1.default.args, commander_1.default.all);
