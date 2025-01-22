#!/usr/bin/env node
import { databaseHooksType } from './databaseHooks.mjs';
export type categoryMatchType = {
    regex: RegExp;
    category: string;
};
export type dataSheetRowType = [
    number,
    string,
    string,
    number,
    string
] | undefined;
interface dataSheetRowObjectType {
    date: number | undefined;
    account: string | undefined;
    label: string | undefined;
    amount: number | undefined;
    category: string | undefined;
}
export interface accountParamType {
    initialAmount: 0;
    type1: string;
    type2: string;
    type3: string;
    lastUpdate: number | undefined;
    index: number;
}
export interface categoryParamType {
    type1: string;
    type2: string;
    index: number;
}
interface histoYearType {
    accounts: {
        [name: string]: number;
    };
    categories: {
        [name: string]: number;
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
        accounts: {
            [name: string]: accountParamType;
        };
        categories: {
            [category: string]: categoryParamType;
        };
        categoryMatches: categoryMatchType[];
    };
    histo: {
        [year: string]: histoYearType;
    };
    hooks: databaseHooksType;
    getParamsAccount: (accountName: string) => accountParamType;
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
    } | {
        date: undefined;
        account: undefined;
        label: undefined;
        amount: undefined;
        category: undefined;
    };
    dataSheetCreateRow(data: dataSheetRowObjectType): (string | number | undefined)[];
    dataSheetForEachRow(callback: (index: number, date: number | undefined, account: string | undefined, label: string | undefined, amount: number | undefined, category: string | undefined) => dataSheetRowObjectType | undefined): Promise<void>;
}
export {};
