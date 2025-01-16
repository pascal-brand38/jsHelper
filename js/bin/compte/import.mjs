#!/usr/bin/env node
// Copyright (c) Pascal Brand
// MIT License
// import data from external account
// this is a TS
import * as fs from 'fs';
// @ts-ignore
import { DateTime } from '../../../extend/luxon.mjs';
// @ts-ignore
import helperJs from '../../../helpers/helperJs.mjs';
function readTSV(filename) {
    const text = fs.readFileSync(filename, 'utf8');
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
        const date = DateTime.fromFormatStartOfDay(row[0]).toExcelSerial();
        resultRows.push({
            date: date,
            label: row[1].replaceAll('"', ''),
            amount: frenchTextToFloat(row[2]),
        });
    });
    resultRows.sort((a, b) => a.date - b.date);
    return { solde, resultRows };
}
export async function importLBPData(workbookHelp) {
    const importName = workbookHelp.database.inputs.importName;
    const accountName = workbookHelp.database.inputs.importAccountName;
    const workbook = workbookHelp.workbook;
    if (importName === undefined) {
        return undefined;
    }
    if (accountName === undefined) {
        return undefined;
    }
    const { solde: lbpSolde, resultRows: importRows } = readLBPTSV(importName);
    const dataSheet = workbook.sheet("data");
    const dataRange = dataSheet.usedRange();
    const rows = await dataRange.value();
    let addRows = [];
    importRows.forEach(importRow => {
        let found = rows.some((row) => (importRow.date === row[0]) && (accountName === row[1]) && (importRow.label === row[2]) && (importRow.amount === row[3]));
        if (!found) {
            addRows.push([importRow.date, accountName, importRow.label, importRow.amount, '=== ERREUR ===']);
        }
    });
    helperJs.info(`  Inserting ${addRows.length} ${accountName} data`);
    if (addRows.length >= 1) {
        const addRange = dataSheet.range(dataRange._maxRowNumber + 1, dataRange._minColumnNumber, dataRange._maxRowNumber + addRows.length, dataRange._maxColumnNumber);
        addRange.value(addRows);
    }
    return lbpSolde;
}
