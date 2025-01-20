#!/usr/bin/env node --max-old-space-size=1048576

// Copyright (c) Pascal Brand
// MIT License

import fs from  'fs'
import path from  'path'
import os from  'os'
import child_process from 'child_process'
import globalJsdom from 'jsdom-global'
import displayMessages from './sms-backup-viewer/displayMessages.mjs'
import { exit } from 'process'

if (process.argv.length !== 3) {
  console.log('Usage: sms-backup-viewer backup.xml')
  exit(-1)
}

globalJsdom()   // declaration of document, windows,... variables in nodejs

document.body.innerHTML = '<div id="container"></div>'    // container is the div that will contain all messages

console.log(`Read file ${process.argv[2]}`)
const xmlText = fs.readFileSync(process.argv[2])
console.log('Generating the html page')
displayMessages.showMessages(xmlText)

var s = new window.XMLSerializer();
var str = s.serializeToString(document);
// console.log(str)

const indexFile = path.join(os.tmpdir(), 'index.html')
console.log(`Writting ${indexFile}`)
fs.writeFileSync(indexFile, str)
child_process.exec(`explorer ${indexFile}`)   // open chrome or firefox or whatever

console.log('DONE')
