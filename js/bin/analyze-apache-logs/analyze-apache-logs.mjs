#!/usr/bin/env node
// Copyright (c) Pascal Brand
// MIT License
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import { program } from 'commander';
import ApacheData from './apache-data.mjs';
import local from './antispam-local.mjs';
function _readConfig(options) {
    const configText = fs.readFileSync(options.config);
    options.config = JSON.parse(configText.toString());
}
function getArgs(argv) {
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    program
        .name('analyze-apache-logs')
        .usage('node analyze-apache-logs <options>')
        .description('Analyze apache logs')
        .arguments('<log-files...>')
        .option('--config <path>', 'Config json file. Default is analyze-apache-logs.json', path.join(__dirname, 'analyze-apache-logs', 'analyze-apache-logs.json'));
    program.parse();
    const options = program.opts();
    _readConfig(options);
    return { options, logs: program.args };
}
export async function analyzeApacheLogs() {
    const { options, logs } = getArgs(process.argv);
    const apacheData = new ApacheData();
    apacheData.readLogs(logs);
    apacheData.populateIps();
    await local.spamDetection(apacheData, options);
    apacheData.print(options);
}
