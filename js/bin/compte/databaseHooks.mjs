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
    return Object.keys(histo).map(year => {
        let total = 0;
        const accounts = histo[year].accounts;
        Object.keys(accounts).forEach(accountName => total += accounts[accountName]);
        return _round(total);
    });
}
function getCategory(database, row) {
    const histo = database.histo;
    const category = row[3];
    return Object.keys(histo).map(year => histo[year].categories[category]);
}
// Revenus - Depenses pour tout ce qui est courant
function getEconomieCourantes(database, row) {
    const histo = database.histo;
    return Object.keys(histo).map(year => {
        let depenses = 0;
        let revenus = 0;
        Object.keys(histo[year].categories).forEach(category => {
            if (database.params.categories[category].type2 === 'Courant') {
                if (database.params.categories[category].type1 === 'Dépenses') {
                    depenses += histo[year].categories[category];
                }
                if (database.params.categories[category].type1 === 'Revenus') {
                    revenus += histo[year].categories[category];
                }
            }
        });
        return _round(revenus + depenses);
    });
}
// par type (type1===row[1]  and type2===row[2])
function getCategoryByType(database, row) {
    const histo = database.histo;
    const type1 = row[1];
    const type2 = row[2];
    return Object.keys(histo).map(year => {
        let total = 0;
        Object.keys(histo[year].categories).forEach(category => {
            if ((!type1 || type1 === database.params.categories[category].type1) &&
                (!type2 || type2 === database.params.categories[category].type2)) {
                total += histo[year].categories[category];
            }
        });
        return _round(total);
    });
}
const databaseHooks = {
    getYears,
    getSumAccounts,
    getCategory,
    getEconomieCourantes,
    getCategoryByType,
};
export default databaseHooks;
