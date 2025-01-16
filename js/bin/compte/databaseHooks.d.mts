#!/usr/bin/env node
import type { databaseType } from './workbookHelper.mts';
declare function getYears(database: databaseType): number[];
declare function getSumAccounts(database: databaseType, row: string[]): number[];
declare function getCategory(database: databaseType, row: string[]): number[];
declare function getEconomieCourantes(database: databaseType, row: string[]): number[];
declare function getCategoryByType(database: databaseType, row: string[]): number[];
declare const databaseHooks: {
    getYears: typeof getYears;
    getSumAccounts: typeof getSumAccounts;
    getCategory: typeof getCategory;
    getEconomieCourantes: typeof getEconomieCourantes;
    getCategoryByType: typeof getCategoryByType;
};
export default databaseHooks;
