#!/usr/bin/env node
export type databaseHooksType = {
    [functionName: string]: Function;
};
export declare const databaseHooks: databaseHooksType;
