#!/usr/bin/env node
import type { databaseType } from './workbookHelper.mts';
declare function getYears(database: databaseType): number[];
declare function getSumAccounts(database: any, row: any): number[];
declare function getCategory(database: any, row: any): any[];
declare function getEconomieCourantes(database: any, row: any): number[];
declare function getCategoryByType(database: any, row: any): number[];
declare const databaseHooks: {
    getYears: typeof getYears;
    getSumAccounts: typeof getSumAccounts;
    getCategory: typeof getCategory;
    getEconomieCourantes: typeof getEconomieCourantes;
    getCategoryByType: typeof getCategoryByType;
};
export default databaseHooks;
