#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import helperJs from '../../helpers/helperJs.mjs'
import type { databaseType } from './workbookHelper.mts'

const _round = ((number: number) => Math.round(number * 100) / 100)

// hooks on database

// row[0] ==> 'getYears"
// row[1] ==> unused
// row[2] ==> unused
// row[3] ==> unused
// row[4] ==> unused
// row[5] ==> unused
//
// return undefined from 0 to 5, and then each year of the data
function getYears(database: databaseType) {
  let years: number[] = []
  for (let year: number=database.params.startYear; year<=database.params.currentYear; year++) {
    years.push(year)
  }
  return [ undefined, undefined, undefined, undefined, undefined, undefined, ...years]
}

// row[0] ==> 'getSumAccounts"
// row[1] ==> the account to be displayed - undefined if sum of all
// row[2] ==> type1 of the accounts to be summed up - undefined if all
// row[3] ==> type2 of the accounts to be summed up - undefined if all
// row[4] ==> type3 of the accounts to be summed up - undefined if all
// row[5] ==> unused - title of the statistic
//
// return undefined from 0 to 5, and then the sum of accounts for each years
function getSumAccounts(database: databaseType, row: (string | undefined)[]) {
  const histo = database.histo
  const accountParam = database.params.accounts
  const searchAccountName= row[1]
  const type1 = row[2]
  const type2 = row[3]
  const type3 = row[4]

  const statRows = Object.keys(histo).map(year => {
    let total = 0
    const accounts = histo[year].accounts
    Object.keys(accounts).forEach(accountName => {
      let toCount = true
      toCount = toCount && ((!searchAccountName) || (searchAccountName === accountName))
      toCount = toCount && ((!type1) || (type1 === accountParam[accountName].type1))
      toCount = toCount && ((!type2) || (type2 === accountParam[accountName].type2))
      toCount = toCount && ((!type3) || (type3 === accountParam[accountName].type3))
      if (toCount) {
        total += accounts[accountName]
      }
    })
    return _round(total)
  })
  return [ undefined, undefined, undefined, undefined, undefined, undefined, ...statRows]
}


// row[0] ==> 'getSumCategories"
// row[1] ==> the category to be displayed - undefined if sum of all
// row[2] ==> type1 of the categories to be summed up - undefined if all
// row[3] ==> type2 of the categories to be summed up - undefined if all
// row[4] ==> unused
// row[5] ==> unused - title of the statistic
//
// return undefined from 0 to 5, and then the sum of categories for each years
function getSumCategories(database: databaseType, row: (string | undefined)[]) {
  const histo = database.histo
  const searchCategory = row[1]
  const type1 = row[2]
  const type2 = row[3]
  const statRows = Object.keys(histo).map(year => {
    let total = 0
    Object.keys(histo[year].categories).forEach(category => {
      let toCount = true
      toCount = toCount && ((!searchCategory) || (searchCategory === category))
      toCount = toCount && ((!type1) || (type1 === database.params.categories[category].type1))
      toCount = toCount && ((!type2) || (type2 === database.params.categories[category].type2))
      if (toCount) {
        total += histo[year].categories[category]
      }
    })
    return _round(total)
  })
  return [ undefined, undefined, undefined, undefined, undefined, undefined, ...statRows]
}


// row[0] ==> 'getAllAccounts"
// row[1] ==> index
// row[2] ==> unused
// row[3] ==> unused
// row[4] ==> unused
//
// return undefined from 0 to 4, then the account name at the provided index,
// and then the sum of categories for each years
function getAllAccounts(database: databaseType, row: (string | undefined)[]) {
  const histo = database.histo
  const params = database.params
  const index = row[1]
  if (index === undefined) {
    helperJs.error('No index for hooks getAllAccounts')
  } else {
    // search the account with this index
    let newRow: (string | number | undefined)[] = []
    const accountNames = Object.keys(database.params.accounts)
    const selectedNames = accountNames.filter(accountName => (database.params.accounts[accountName].index === parseInt(index)))
    if (selectedNames.length === 0) {
      const values = new Array(params.currentYear - params.startYear + 1).fill('');
      newRow = [ undefined, undefined, undefined, undefined, undefined, '', ...values ]
    } else {
      const values = Object.keys(histo).map(year => histo[year].accounts[selectedNames[0]])
      newRow = [ undefined, undefined, undefined, undefined, undefined, selectedNames[0], ...values ]
    }
    return newRow
  }
}

export type databaseHooksType = { [functionName: string]: Function }
export const databaseHooks: databaseHooksType = {
  getYears,
  getSumAccounts,
  getSumCategories,
  getAllAccounts,
}
