#!/usr/bin/env node
// Copyright (c) Pascal Brand
// MIT License
// import data from external account
import databaseHooks from './databaseHooks.mjs';
import helperJs from '../../../helpers/helperJs.mjs';
export class workbookHelper {
    constructor(compteName, importFile, importAccount) {
        this.workbook = undefined;
        this.errors = []; // list of strings of errors to check
        this.database = {
            inputs: {
                compteName: compteName, // xslx file to be updated: categpry, importing new data,...
                importName: importFile, // name of the file to import, from LBP. May be optional
                importAccountName: importAccount, // account that is being imported, from LBP. Linked to importName
            },
            params: {
                startDate: undefined,
                startYear: undefined,
                currentYear: undefined,
                // TODO: make accounts as an object of accountName
                accounts: [], // list of all the accounts  { name, initialAmount, type1, type2, type3, lastUpdate }
                categories: {}, // object of 'categoryName': { type1, type2 }
                categoryMatches: [], // list of { regex, category }  to match LBP labels
            },
            histo: { // historic data, per years
            },
            hooks: databaseHooks,
            getParamsAccount: (accountName) => this.database.params.accounts.filter(account => (account.name === accountName))[0],
        };
    }
    setError(text) {
        if (!this.errors.includes(text)) {
            this.errors.push(text);
        }
    }
    displayErrors() {
        if (this.errors.length !== 0) {
            console.log('\x1b[32m' + '******* ERRORS TO BE CHECKED' + '\x1b[0m');
            this.errors.forEach(e => console.log('\x1b[31m' + e + '\x1b[0m'));
        }
        else {
            console.log('\x1b[32m' + '******* No detected errors' + '\x1b[0m');
        }
    }
    async readSheet(sheetName) {
        const dataSheet = this.workbook.sheet(sheetName);
        const dataRange = dataSheet.usedRange();
        return await dataRange.value();
    }
    // "data" sheet
    dataSheetExtractRow(row) {
        return {
            date: row[0], // excel serial date
            account: row[1], // Livret
            label: row[2], // I bought a present
            amount: row[3], // 100
            category: row[4], // Alimentation
        };
    }
    dataSheetCreateRow({ date, account, label, amount, category }) {
        return [date, account, label, amount, category,];
    }
    // callback is a function taking in arguments:
    //    (index, date, account, label, amount, category)
    // and returns an array of new rows. If undefined, they should not be updated
    async dataSheetForEachRow(callback) {
        let update = false;
        const dataSheet = this.workbook.sheet("data");
        const dataRange = dataSheet.usedRange();
        const rows = await dataRange.value();
        const updatedRows = rows.map((row, index) => {
            const { date, account, label, amount, category } = this.dataSheetExtractRow(row);
            const result = callback(index, date, account, label, amount, category);
            // check it is coherent (always return, or never)
            if (index >= 1) {
                if (update !== (result !== undefined)) {
                    helperJs.error('Process() returns undefined and not undefined');
                }
            }
            if (result !== undefined) {
                update = true;
                return this.dataSheetCreateRow({
                    date: result.date ? result.date : date,
                    account: result.account ? result.account : account,
                    label: result.label ? result.label : label,
                    amount: result.amount ? result.amount : amount,
                    category: result.category ? result.category : category,
                });
            }
        });
        if (update) {
            // update the data sheet
            await dataRange.value(updatedRows);
        }
    }
}
