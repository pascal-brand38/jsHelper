#!/usr/bin/env node
// Copyright (c) Pascal Brand
// MIT License
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { mboxReader } from 'mbox-reader'; // scan messages
import { simpleParser } from 'mailparser'; // parse a single message
import pLimit from 'p-limit'; // limit the number of processed emails in parallel
import { program } from 'commander';
import { LIB_VERSION } from './version.mjs';
// var colors = require('colors');
import 'colors';
const skipPaths = [
    "[Gmail].sbd\\Important",
    "[Gmail].sbd\\Suivis",
    "[Gmail].sbd\\Tous les messages",
    "[Gmail].sbd\\Corbeille",
];
const _stats = {
    nTotal: 0, // total number of emails
    nNew: 0, // new emails that have been pdfed
    nAttachement: 0, // number of downloaded attachments - do not count skipped emails
    duplicate: {
        self: {},
    }
};
function escape(s) {
    return s.replace(/[^0-9A-Za-z ]/g, c => "&#" + c.charCodeAt(0) + ";");
}
function fixFilename(filename) {
    return filename.replace(/[\:\\\/\*\?\"\<\>\|\[\]\t]/g, '').trim();
}
function getAddress(parser, what) {
    const value = parser.headers.get(what);
    if (value) {
        // value is either an AddressObject, or an array of AddressObject (?)
        let text = value.text;
        if (text !== undefined) {
            return text;
        }
        else {
            // console.log(value)
            const values = value;
            text = '';
            values.forEach((v, index) => {
                if (v.text === undefined) {
                    console.log(parser.headers);
                    console.log(what, ' ', values);
                    throw 'Internal Error - cannot recover';
                }
                if (index === 0) {
                    text = v.text;
                }
                else {
                    text = text + ', ' + v.text;
                }
            });
            return text;
        }
    }
    else {
        return '';
    }
}
function getHeader(parser) {
    const header = {
        from: '',
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        date: '',
        basename: ''
    };
    header.from = getAddress(parser, 'from');
    header.to = getAddress(parser, 'to');
    header.cc = getAddress(parser, 'cc');
    header.bcc = getAddress(parser, 'bcc');
    const date = parser.headers.get('date');
    if (date) {
        const d = date;
        header.date = d.toLocaleString();
        header.basename = `${d.getFullYear()}-${(d.getMonth() + 1).toLocaleString(undefined, { minimumIntegerDigits: 2 })}-${d.getDate().toLocaleString(undefined, { minimumIntegerDigits: 2 })}`;
        header.basename += `-${d.getHours().toLocaleString(undefined, { minimumIntegerDigits: 2 })}.${d.getMinutes().toLocaleString(undefined, { minimumIntegerDigits: 2 })}.${d.getSeconds().toLocaleString(undefined, { minimumIntegerDigits: 2 })}`;
    }
    const subject = parser.headers.get('subject');
    if (subject) {
        header.subject = subject;
        header.basename += ` - ${header.subject.replace(/[\:\\\/\*\?\"\<\>\|]/g, '')}`;
    }
    header.basename = fixFilename(header.basename);
    // basename should not be more than 80 char
    if (header.basename.length >= 80) {
        header.basename = header.basename.slice(0, 80);
    }
    // rm '.' if last char as not ok on directory of windows
    while (header.basename.endsWith('.')) {
        header.basename = header.basename.slice(0, -1);
    }
    Object.keys(header).forEach(_key => {
        // cf. https://stackoverflow.com/questions/55012174/why-doesnt-object-keys-return-a-keyof-type-in-typescript
        const key = _key;
        if (header[key] === undefined) {
            console.log('Erreur: header has some undefined: '.red, header);
            console.log(parser.headers);
        }
    });
    return header;
}
function beautifulSize(s) {
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
}
function getHtml(parser, header) {
    let bodyStr = '';
    if (parser.html) {
        bodyStr = parser.html;
    }
    else if (parser.text) {
        bodyStr = `<div>${parser.text.replaceAll('\n', '<br>')}</div>`;
    }
    else if (parser.textAsHtml) {
        bodyStr = parser.textAsHtml;
        console.log('ERROR - textAsHtml:'.red, header);
    }
    let html = '';
    html += `<div style="background-color:lightgrey; padding: 16px;">`;
    // html += '<div><br></div>'
    html += '<div><em>Generated using https://npmjs.com/package/mail-to-pdf</em></div>';
    html += '<div><br></div>';
    html += `<div>From: ${escape(header.from)}</div>`;
    html += `<div>To: ${escape(header.to)}</div>`;
    html += `<div>Cc: ${escape(header.cc)}</div>`;
    html += `<div>Bcc: ${escape(header.bcc)}</div>`;
    html += `<div>Subject: ${escape(header.subject)}</div>`;
    html += `<div>Date: ${escape(header.date)}</div>`;
    // html += '<div><br></div>'
    html += `</div>`;
    html += '<div><br></div>';
    html += bodyStr;
    html += '<div><br></div>';
    if (parser.attachments.length !== 0) {
        html += `<div style="background-color:lightgrey; padding: 16px;">`;
        // html += '<div><br></div>'
        parser.attachments.forEach((attachment, index) => {
            html += `<div>`;
            if (attachment.filename) {
                html += `attachments: ${attachment.filename}`;
            }
            else {
                html += `attachments: unknown`;
            }
            html += ` ${beautifulSize(attachment.content.length)}`;
            html += `</div>`;
        });
        // html += '<div><br></div>'
        html += `</div>`;
    }
    return html;
}
function filenameFromContentType(contentType, index, header) {
    const contentTypeToExtension = [
        { contentType: 'message/rfc822', extension: 'eml', },
        { contentType: 'application/pdf', extension: 'pdf', },
        { contentType: 'image/jpeg', extension: 'jpg', },
        { contentType: 'image/jpg', extension: 'jpg', },
        { contentType: 'image/png', extension: 'png', },
        { contentType: 'image/gif', extension: 'gif', },
        { contentType: 'text/calendar', extension: 'ics', },
        // octet-stream when the mime type is unknown
        // may come from the sender configuration
        // cf. https://www.webmaster-hub.com/topic/57548-r%C3%A9solu-les-extensions-de-fichiers-joints-que-je-re%C3%A7ois-sous-thunderbird-sont-modifi%C3%A9es-et-deviennent-donc-illisibles/
        { contentType: 'application/octet-stream', extension: 'octet-stream', },
    ];
    let extension;
    const c = contentTypeToExtension.filter(c => contentType === c.contentType);
    if (c.length === 1) {
        extension = c[0].extension;
    }
    else {
        extension = 'unknown';
        console.log('ERROR attachment without filename: '.red, header);
        console.log(`attachment.contentType = ${contentType}`.red);
    }
    return `attachment-${index}.${extension}`;
}
const _treatedEmails = {
    targetDir: {},
    basename: {},
};
async function mailToPdf(options, message, outputDir, mboxPath) {
    const parser = await simpleParser(message.content);
    const header = getHeader(parser);
    _stats.nTotal++;
    // console.log(parser)
    // throw 'STOP'
    // console.log(`--- ${header.basename}`)
    const targetDir = path.join(outputDir, header.basename);
    // check duplicated emails
    if (_treatedEmails.targetDir[targetDir]) {
        if (_stats.duplicate.self[mboxPath] === undefined) {
            _stats.duplicate.self[mboxPath] = [];
        }
        _stats.duplicate.self[mboxPath].push(header.basename);
    }
    else {
        _treatedEmails.targetDir[targetDir] = true;
    }
    if (_treatedEmails.basename[header.basename] === undefined) {
        _treatedEmails.basename[header.basename] = [];
    }
    _treatedEmails.basename[header.basename].push(targetDir);
    // check if it already exists. If so, do not regenerate anything
    const pdfFullName = path.join(targetDir, header.basename + '.pdf');
    if (options.force || !fs.existsSync(pdfFullName)) {
        if (!options.dryRun) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        parser.attachments.forEach((attachment, index) => {
            let filename = attachment.filename;
            if (!filename) {
                filename = filenameFromContentType(attachment.contentType, index, header);
            }
            filename = fixFilename(filename);
            if (!options.dryRun) {
                fs.writeFileSync(path.join(targetDir, filename), attachment.content);
            }
            _stats.nAttachement++;
        });
        _stats.nNew++;
    }
    const lenWhite = 80 + 20;
    process.stdout.write(`${" ".repeat(lenWhite)}\r`.green);
    process.stdout.write(`--- ${_stats.nNew}/${_stats.nTotal} ${header.basename}\r`.green);
}
async function mboxToPdf(options, mboxPath, outputDir) {
    if (skipPaths.some(skipPath => mboxPath.endsWith(skipPath))) {
        console.log(`Skip mbox file: ${mboxPath}`.yellow);
        return;
    }
    let displayedMessage = false;
    function displayMessage() {
        if (!displayedMessage) {
            console.log(`Processing mbox file: ${mboxPath}`.blue);
            console.log(`Creating outputs in: ${outputDir}`.blue);
            displayedMessage = true;
        }
    }
    const readStream = fs.createReadStream(mboxPath);
    if (options.parallel) {
        let promises = [];
        const limit = pLimit(5); // max of 5 emails in parallel
        for await (let message of mboxReader(readStream)) {
            displayMessage();
            promises.push(limit(() => mailToPdf(options, message, outputDir, mboxPath)));
        }
        await Promise.all(promises);
    }
    else {
        for await (let message of mboxReader(readStream)) {
            displayMessage();
            await mailToPdf(options, message, outputDir, mboxPath);
        }
    }
    console.log(); // newline to see last log of this mbox path
}
function getDirectories(source) {
    try {
        return fs.readdirSync(source, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    }
    catch {
        return [];
    }
}
function getMboxPaths(input, outputDir) {
    try {
        let results = [];
        const stat = fs.statSync(input);
        if (stat.isFile()) {
            results.push({ fullInputPath: input, fullOutputPath: outputDir });
        }
        else {
            const contents = fs.readdirSync(input, { withFileTypes: true });
            contents.forEach(c => {
                if (c.isDirectory()) {
                    results = [...results, ...getMboxPaths(path.join(input, c.name), path.join(outputDir, c.name))];
                }
                else if (c.isFile()) {
                    results.push({ fullInputPath: path.join(input, c.name), fullOutputPath: path.join(outputDir, c.name) });
                }
            });
        }
        return results;
    }
    catch {
        return [];
    }
}
function getArgs() {
    program
        .name('mail-to-pdf')
        .version(LIB_VERSION) // TODO: use dynamic version from package.json
        .usage('node dist/mail-to-pdf <options> --output-dir <dir>')
        .description('Save emails as pdf, along with the attachment files')
        .option('--input <dir|mbox>', 'input, either a directory or a mbox file. When not provided, is looking at thunderbird mbox files (working on windows only)')
        .requiredOption('--output-dir <dir>', 'output directory of the pdf and attachments')
        .option('--no-parallel', 'Use --no-parallel to run sequentially', true)
        .option('--force', 'Force creation of the pdf, even if already exists', false)
        .option('--dry-run', 'dryrun - nothing is generated', false)
        .option('--no-skip', `Use --no-skip not to skip ${skipPaths}`, true),
        program.parse();
    return program.opts();
    // .example('$0 --output-dir /tmp/test', 'save all emails of thunderbirds (windows) as pdf, along their attachments, in /tmp/test')
    // .example('$0 --input file.mbox --output-dir /tmp/test', 'save all emails of file.mbox as pdf, along their attachments, in /tmp/test')
    // .example('$0 --input directory --output-dir /tmp/test', 'save all emails in driectory (look for all mbox files recursively in this directory) as pdf, along their attachments, in /tmp/test')
}
export async function flattenMboxes() {
    const options = getArgs();
    let inputs = [];
    if (options.input === undefined) {
        // thunderbird on windows is used by default
        const appdata = process.env['APPDATA'];
        if (!appdata) {
            throw '$APPDATA is not defined in the environment variables';
        }
        const thunderbirdProfileDir = path.join(appdata, 'Thunderbird', 'Profiles');
        inputs = getDirectories(thunderbirdProfileDir).map(dir => path.join(thunderbirdProfileDir, dir, 'ImapMail'));
    }
    else {
        inputs = [options.input];
    }
    if (true) {
        for (let input of inputs) {
            for await (let desc of getMboxPaths(input, options.outputDir)) {
                console.log(desc.fullInputPath.blue);
                console.log(desc.fullOutputPath.blue);
                await mboxToPdf(options, desc.fullInputPath, desc.fullOutputPath);
            }
        }
    }
    else {
        const mboxPath = '';
        await mboxToPdf(options, mboxPath, 'C:/tmp/mail-to-pdf/output');
    }
    console.log();
    console.log(`Number of emails: ${_stats.nTotal}`.green);
    console.log(`Number of new emails: ${_stats.nNew}`.green);
    console.log(`Number of generated attachments: ${_stats.nAttachement}`.green);
    const keysDup = Object.keys(_stats.duplicate.self);
    if (keysDup.length === 0) {
        console.log('mbox that contain duplication: NONE'.green);
    }
    else {
        console.log(`mbox that contain duplication:`.green);
        keysDup.forEach(key => {
            console.log(`  - ${key}: ${_stats.duplicate.self[key].length}`.blue);
            if (_stats.duplicate.self[key].length < 10) {
                _stats.duplicate.self[key].forEach(value => console.log(`       ${value}`.blue));
            }
        });
    }
    let nDup = 0;
    Object.keys(_treatedEmails.basename).forEach(basename => {
        if (_treatedEmails.basename[basename].length >= 2) {
            nDup += (_treatedEmails.basename[basename].length - 1);
            console.log(`Duplicate email:`);
            _treatedEmails.basename[basename].forEach(l => console.log(`    ${l}`.blue));
        }
    });
    console.log(`Number of duplicated emails: ${nDup}`.green);
    console.log('DONE'.green);
}
