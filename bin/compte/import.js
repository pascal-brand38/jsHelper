#!/usr/bin/env node
"use strict";
// Copyright (c) Pascal Brand
// MIT License
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importLBPData = importLBPData;
// import data from external account
const fs_1 = __importDefault(require("fs"));
const luxon_mjs_1 = require("../../../extend/luxon.mjs");
const helperJs_1 = __importDefault(require("helpers/helperJs"));
function readTSV(filename) {
    const text = fs_1.default.readFileSync(filename, 'utf8');
    const rows = [];
    text.split('\n').forEach(rowText => {
        const row = rowText.trim().split('\t');
        rows.push(row);
    });
    return rows;
}
function frenchTextToFloat(text) {
    return parseFloat(text.replaceAll(',', '.'));
}
function readLBPTSV(filename) {
    let rows = readTSV(filename);
    // look for solde in TSV
    let solde = undefined;
    rows.forEach(row => {
        if (row[0] && row[0].startsWith('Solde (EUROS)')) {
            solde = frenchTextToFloat(row[1]);
        }
    });
    // leave only amount data, processed with date and value
    // const resultRows: [ [ number, string, number ] ] | [] = []
    const resultRows = [];
    rows = rows.filter(row => ((row.length === 3) && !isNaN(frenchTextToFloat(row[2]))));
    rows.forEach(row => {
        const date = luxon_mjs_1.DateTime.fromFormatStartOfDay(row[0]).toExcelSerial();
        resultRows.push({
            date: date,
            label: row[1].replaceAll('"', ''),
            amount: frenchTextToFloat(row[2]),
        });
    });
    resultRows.sort((a, b) => a[0] - b[0]);
    return { solde, resultRows };
}
async function importLBPData(workbookHelp) {
    const importName = workbookHelp.database.inputs.importName;
    const accountName = workbookHelp.database.inputs.importAccountName;
    const workbook = workbookHelp.workbook;
    if (importName === undefined && accountName === undefined) {
        return undefined;
    }
    const { solde: lbpSolde, resultRows: importRows } = readLBPTSV(importName);
    const dataSheet = workbook.sheet("data");
    const dataRange = dataSheet.usedRange();
    const rows = await dataRange.value();
    let addRows = [];
    importRows.forEach(importRow => {
        let found = rows.some(row => (importRow.date === row[0]) && (accountName === row[1]) && (importRow.label === row[2]) && (importRow.amount === row[3]));
        if (!found) {
            addRows.push([importRow.date, accountName, importRow.label, importRow.amount, '=== ERREUR ===']);
        }
    });
    helperJs_1.default.info(`  Inserting ${addRows.length} ${accountName} data`);
    if (addRows.length >= 1) {
        const addRange = dataSheet.range(dataRange._maxRowNumber + 1, dataRange._minColumnNumber, dataRange._maxRowNumber + addRows.length, dataRange._maxColumnNumber);
        addRange.value(addRows);
    }
    return lbpSolde;
}
