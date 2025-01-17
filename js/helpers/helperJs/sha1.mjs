// Copyright (c) Pascal Brand
// MIT License
import * as fs from 'fs';
import * as crypto from 'node:crypto';
// @ts-ignore
import fileSyncCmp from 'file-sync-cmp';
// read a file chunk by chunk
const chunkSize = 10 * 1024 * 1024; // read files by 10MB chunk size
const chunkBuffer = Buffer.alloc(chunkSize);
// get sha1 of a file, given its filename
function getSha1(filename) {
    let fp = fs.openSync(filename, 'r');
    let bytesRead = 0;
    let offset = 0;
    let sha1Struct = crypto.createHash('sha1');
    while (bytesRead = fs.readSync(fp, chunkBuffer, 0, chunkSize, offset)) {
        const data = chunkBuffer.subarray(0, bytesRead);
        sha1Struct.update(data);
        offset += bytesRead;
    }
    fs.closeSync(fp);
    return sha1Struct.digest("hex");
}
// initialize sha1 list
function initSha1List() { return {}; }
// add a sha1, corresponding to a filename, in a list
// if checkCollision=true and in case of collision, throw an error if the collision files do not have the same content
function updateSha1List(sha1List, sha1sum, filename, checkCollision = true) {
    if (sha1List[sha1sum] === undefined) {
        sha1List[sha1sum] = [];
    }
    else {
        // check files are the same
        if ((checkCollision) && (!fileSyncCmp.equalFiles(filename, sha1List[sha1sum][0]))) {
            throw (`Different files, but same sha1: ${filename} vs ${sha1List[sha1sum][0]}`);
        }
    }
    sha1List[sha1sum].push(filename);
    return sha1List;
}
// return true if a filename sha1 is in sha1List
// in case of collision, and if the file contents differ, an exception is thrown
function isInSha1List(sha1List, filename) {
    const sha1sum = getSha1(filename);
    if (sha1List[sha1sum] === undefined) {
        return undefined;
    }
    else {
        if (!fileSyncCmp.equalFiles(filename, sha1List[sha1sum][0])) {
            throw (`Different files, but same sha1: ${filename} vs ${sha1List[sha1sum][0]}`);
        }
        return sha1List[sha1sum][0];
    }
}
export default {
    getSha1,
    initSha1List,
    updateSha1List,
    isInSha1List,
};
