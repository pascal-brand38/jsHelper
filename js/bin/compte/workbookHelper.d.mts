#!/usr/bin/env node
import databaseHooks from './databaseHooks.mjs';
export type dataSheetRowType = [
    number,
    string,
    string,
    number,
    string
];
interface dataSheetRowObjectType {
    date: number | undefined;
    account: string | undefined;
    label: string | undefined;
    amount: number | undefined;
    category: string | undefined;
}
interface accountType {
    name: string;
    initialAmount: 0;
    type1: string;
    type2: string;
    type3: string;
    lastUpdate: number;
}
interface categoryParamType {
    type1: string;
    type2: string;
}
interface histoYearType {
    accounts: {
        [key: string]: number;
    };
    categories: {
        [key: string]: number;
    };
}
export interface databaseType {
    inputs: {
        compteName: string;
        importName: string | undefined;
        importAccountName: string | undefined;
    };
    params: {
        startDate: number;
        startYear: number;
        currentYear: number;
        accounts: accountType[];
        categories: {
            [key: string]: categoryParamType;
        };
        categoryMatches: [];
    };
    histo: {
        [key: string]: histoYearType;
    };
    hooks: typeof databaseHooks;
    getParamsAccount: (accountName: string) => accountType;
}
export declare class workbookHelper {
    workbook: any;
    errors: string[];
    database: databaseType;
    constructor(compteName: string, importFile: string | undefined, importAccount: string | undefined);
    setError(text: string): void;
    displayErrors(): void;
    readSheet(sheetName: string): Promise<any>;
    dataSheetExtractRow(row: dataSheetRowType): {
        date: number;
        account: string;
        label: string;
        amount: number;
        category: string;
    };
    dataSheetCreateRow(data: dataSheetRowObjectType): (string | number | undefined)[];
    dataSheetForEachRow(callback: (index: number, date: number, account: string, label: string, amount: number, category: string) => dataSheetRowObjectType): Promise<void>;
}
export {};
