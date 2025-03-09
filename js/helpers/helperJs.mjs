/// Copyright (c) Pascal Brand
/// MIT License
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
// @ts-ignore
import pdfjsdist from '../../extend/pdfjs-dist.mjs';
import sha1 from './helperJs/sha1.mjs';
// https://nodejs.org/api/readline.html
// https://stackoverflow.com/questions/74903152/running-node-js-readline-functions
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
function warning(s) {
    console.log('WARNING');
    console.log('WARNING  ', s);
    console.log('WARNING');
}
function error(s) {
    console.log('***');
    console.log('***  ERREUR');
    console.log('*** ', s);
    console.log('***');
    throw ('ERROR'); // throw so that when called from excel, it does not kill the window
    // TODO: exit, without throw, but without killing the window
}
const question = {
    // question: async (text) =>  await new Promise(resolve => {
    //   const rl = readline.createInterface({ input, output })
    //   rl.question(`${text}`, resolve)
    // })
    question: async (text) => {
        const rl = readline.createInterface({ input, output });
        const answer = await rl.question(`${text}`);
        rl.close();
        return answer;
    }
};
const thunderbird = {
    compose: async (email, subject, body, attachment = null, exe = '"C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe"', forbiddenWords = ['undefined', 'infinity', ' nan€', ' nan ',]) => {
        // check the email does not contain any forbidden words
        const allWords = (email + ' ' + subject + ' ' + body).toLowerCase();
        forbiddenWords.forEach(w => {
            if (allWords.includes(w)) {
                error(`The email contains the word ${w}: ${allWords}`);
            }
        });
        // check the pdf attachement does not contain any forbidden words
        if (attachment != null) {
            if (attachment.endsWith('.pdf')) { // only for pdf
                const doc = await pdfjsdist.load(attachment);
                const texts = await doc.getText();
                const str = texts.join(' ').toLowerCase();
                forbiddenWords.forEach(w => {
                    if (str.includes(w)) {
                        error(`The pdf ${attachment} contains the word ${w}`);
                    }
                });
            }
        }
        // http://kb.mozillazine.org/Command_line_arguments_-_Thunderbird
        const to = `to='${email}'`;
        subject = `subject=${encodeURIComponent(subject)}`;
        body = `body=${encodeURIComponent(body)}`;
        let cmd;
        if (attachment != null) {
            attachment = `attachment=${attachment.replace(/\\/g, '/')}`;
            cmd = `${exe} -compose "${to},${subject},${body},${attachment}"`;
        }
        else {
            cmd = `${exe} -compose "${to},${subject},${body}"`;
        }
        console.log(cmd);
        child_process.exec(cmd);
    },
};
/// get the list of all files in rootDir, from subDir recursiveley
function _walkDir(rootDir, options, files, subDir) {
    const thisDir = path.join(rootDir, subDir);
    fs.readdirSync(thisDir).forEach(file => {
        if (options.excludes.includes(file)) {
            return;
        }
        const absolute = path.join(thisDir, file);
        const sub = path.join(subDir, file);
        if (fs.statSync(absolute).isDirectory()) {
            _walkDir(rootDir, options, files, sub);
        }
        else {
            files.push(sub);
            if ((options.stepVerbose > 0) && ((files.length % options.stepVerbose) === 0)) {
                console.log(`      ${files.length} files found`);
            }
        }
    });
    if ((subDir === '.') && (options.stepVerbose > 0)) {
        console.log(`      ${files.length} files found`);
    }
}
function _createOptions(options, defaultOptions) {
    let currentOptions = {};
    if (options === undefined) {
        currentOptions = defaultOptions;
    }
    else {
        Object.keys(defaultOptions).forEach(o => {
            currentOptions[o] = (options[o] === undefined) ? defaultOptions[o] : options[o];
        });
    }
    return currentOptions;
}
function walkDir(rootDir, options) {
    // create options
    const defaultOptions = {
        excludes: [], // list of files / directories to exclude from the list
        stepVerbose: -1, // no verbose
    };
    const currentOptions = _createOptions(options, defaultOptions);
    let files = [];
    _walkDir(rootDir, currentOptions, files, '.');
    return files;
}
const utils = {
    getImmediateSubdirs: (dir) => {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((item) => item.isDirectory())
            .map((item) => item.name);
    },
    error,
    warning,
    sleep: async (s) => new Promise(r => setTimeout(r, s * 1000)),
    walkDir,
    beautifulSize(s) {
        if (s < 1024) {
            return `${s.toFixed(2)}Bytes`;
        }
        else if (s < 1024 * 1024) {
            return `${(s / 1024).toFixed(2)}KB`;
        }
        else if (s < 1024 * 1024 * 1024) {
            return `${(s / (1024 * 1024)).toFixed(2)}MB`;
        }
        else {
            return `${(s / (1024 * 1024 * 1024)).toFixed(2)}GB`;
        }
    },
    capitalizeFirstLetter(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
};
export default {
    question,
    thunderbird,
    utils,
    sha1: {
        getSha1: sha1.getSha1,
        initSha1List: sha1.initSha1List,
        updateSha1List: sha1.updateSha1List,
        isInSha1List: sha1.isInSha1List,
    },
    info: (text) => console.log('\x1b[34m' + text + '\x1b[0m'), // blue
    logError: (text) => console.log('\x1b[31m' + text + '\x1b[0m'), // red
    // cf. https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
    textColor: (text, color) => {
        let colorCode;
        if (color === 'FgRed') {
            colorCode = '\x1b[31m';
        }
        else if (color === 'FgBlue') {
            colorCode = '\x1b[34m';
        }
        else if (color === 'FgGreen') {
            colorCode = '\x1b[32m';
        }
        else if (color === 'FgYellow') {
            colorCode = '\x1b[33m';
        }
        else if (color === 'FgCyan') {
            colorCode = '\x1b[36m';
        }
        else {
            colorCode = '\x1b[31m';
        } // red by default
        return colorCode + text + '\x1b[0m';
    },
    warning,
    error,
};
