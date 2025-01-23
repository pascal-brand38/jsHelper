#!/usr/bin/env node
import '../../extend/luxon.mjs';
export type databaseHooksType = {
    [functionName: string]: Function;
};
export declare const databaseHooks: databaseHooksType;
