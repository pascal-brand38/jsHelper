#!/usr/bin/env node
export declare class workbookHelper {
    workbook: any;
    errors: string[];
    database: any;
    constructor(compteName: any, importFile: any, importAccount: any);
    setError(text: any): void;
    displayErrors(): void;
    readSheet(sheetName: any): Promise<any>;
    dataSheetExtractRow(row: any): {
        date: any;
        account: any;
        label: any;
        amount: any;
        category: any;
    };
    dataSheetCreateRow({ date, account, label, amount, category }: {
        date: any;
        account: any;
        label: any;
        amount: any;
        category: any;
    }): any[];
    dataSheetForEachRow(callback: any): Promise<void>;
}
