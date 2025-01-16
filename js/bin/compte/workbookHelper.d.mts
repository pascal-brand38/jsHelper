#!/usr/bin/env node
interface dataSheetRowType {
    date: string;
    account: string;
    label: string;
    amount: string;
    category: string;
}
interface accountType {
    name: string;
    initialAmount: 0;
    type1: string;
    type2: string;
    type3: string;
    lastUpdate: number;
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
        categories: {};
        categoryMatches: [];
    };
    histo: {};
    hooks: any;
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
    dataSheetExtractRow(row: string[]): {
        date: string;
        account: string;
        label: string;
        amount: string;
        category: string;
    };
    dataSheetCreateRow(data: dataSheetRowType): string[];
    dataSheetForEachRow(callback: (index: number, date: string, account: string, label: string, amount: string, category: string) => dataSheetRowType): Promise<void>;
}
export {};
