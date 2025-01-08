#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// hooks on database

// return an array of years
function getYears(database) {
  let years = []
  for (let year=database.params.startYear; year<=database.params.currentYear; year++) {
    years.push(year)
  }
  return years
}

// return an array of sum of accounts per year
function getSumAccounts(database) {
  const histo = database.histo
  return Object.keys(histo).map(year => {
    let total = 0
    const accounts = histo[year].accounts
    Object.keys(accounts).forEach(accountName => total += accounts[accountName])
    return Math.round(total * 100) / 100
  })
}

function getCategory(database, row) {
  const category = row[3]
  const histo = database.histo
  return Object.keys(histo).map(year => histo[year].categories[category])
}

const databaseHooks = {
  getYears,
  getSumAccounts,
  getCategory,
}

export default databaseHooks
