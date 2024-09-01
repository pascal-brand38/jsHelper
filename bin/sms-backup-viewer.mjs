#!/usr/bin/env node --max-old-space-size=1048576

// Copyright (c) Pascal Brand
// MIT License

import fs from  'fs'
import path from  'path'
import os from  'os'
import child_process from 'child_process'
import globalJsdom from 'jsdom-global'
import displayMessages from './sms-backup-viewer/displayMessages.mjs'
globalJsdom()

document.body.innerHTML = '<div id="container"></div>'
let DOMParser = window.DOMParser

displayMessages.init()

console.log(process.argv)
const xmlText = fs.readFileSync(process.argv[2])
displayMessages.showMessages(xmlText)

var s = new window.XMLSerializer();
var str = s.serializeToString(document);
// console.log(str)

const indexFile = path.join(os.tmpdir(), 'index.html')
console.log(`Writting ${indexFile}`)
fs.writeFileSync(indexFile, str)
child_process.exec(`explorer ${indexFile}`)

// console.log(window.XMLSerializer(document))
console.log('DONE')
