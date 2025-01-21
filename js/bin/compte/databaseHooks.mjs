#!/usr/bin/env node
// Copyright (c) Pascal Brand
// MIT License
const _round = ((number) => Math.round(number * 100) / 100);
// hooks on database
// return an array of years
function getYears(database) {
    let years = [];
    for (let year = database.params.startYear; year <= database.params.currentYear; year++) {
        years.push(year);
    }
    return years;
}
// return an array of sum of accounts per year
function getSumAccounts(database, row) {
    const histo = database.histo;
    const accountParam = database.params.accounts;
    const type1 = row[2];
    return Object.keys(histo).map(year => {
        let total = 0;
        const accounts = histo[year].accounts;
        Object.keys(accounts).forEach(accountName => {
            if (!type1 || (accountParam[accountName].type1 === type1)) {
                total += accounts[accountName];
            }
        });
        return _round(total);
    });
}
// par type (type1===row[1]  and type2===row[2])
function getSumCategories(database, row) {
    const histo = database.histo;
    const searchCategory = row[1];
    const type1 = row[2];
    const type2 = row[3];
    return Object.keys(histo).map(year => {
        let total = 0;
        Object.keys(histo[year].categories).forEach(category => {
            let toCount = true;
            toCount = toCount && ((!searchCategory) || (searchCategory === category));
            toCount = toCount && ((!type1) || (type1 === database.params.categories[category].type1));
            toCount = toCount && ((!type2) || (type2 === database.params.categories[category].type2));
            if (toCount) {
                total += histo[year].categories[category];
            }
        });
        return _round(total);
    });
}
export const databaseHooks = {
    getYears,
    getSumAccounts,
    getSumCategories,
};
