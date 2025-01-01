#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import fs from 'fs'
import xlsxPopulate from 'xlsx-populate'

import helperJs from '../helpers/helperJs.mjs'

function getLastAmounts(workbook, accounts) {
  const dataSheet = workbook.sheet("last")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()

  rows.forEach(row => {
    const account = row[0]
    const lastAmount = row[2] ? row[2] : 0

    if (account) {
      accounts[account].lastAmount = lastAmount
    }
  })
}

function initAccounts(workbook) {
  const accounts = {}
  const dataSheet = workbook.sheet("init")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()

  rows.forEach(row => {
    const account = row[0]
    const initDate = row[1]   // all the same date
    const initAmount = row[2] ? row[2] : 0

    if (account) {
      accounts[account] = {}
      accounts[account].init = initAmount
      accounts[account].initDate = initDate
      accounts[account].amount = initAmount
    }
  })

  getLastAmounts(workbook, accounts)
  return accounts
}


async function main() {
  const argv = process.argv
  if (argv.length !== 3) {
    helperJs.error('Usage: node bin/comptes.mjs /c/Users/pasca/Desktop/compte.xlsx')
  }


  const compteName = argv[2]
  const compteResult = 'C:/Users/pasca/Desktop/compte-copy.xlsx'

  const workbook = await xlsxPopulate.fromFileAsync(compteName)

  const accounts = initAccounts(workbook)

  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()
  rows.forEach((row, index) => {
    const date = row[0]
    if (!date) {
      row[0] = rows[index-1][0]
    }
  })
  rows.forEach(row => {
    const date = row[0]       // excel serial date
    const account = row[1]    // ex: 'Livret'
    // row[2] = comment
    const amount = row[3]
    // row[4] = category

    if (account && amount && (date > accounts[account].initDate)) {
      accounts[account].amount += amount
    }
  })

  const amounts = {}
  Object.keys(accounts).map(key => amounts[key] = Math.round(accounts[key].amount * 100) / 100)
  Object.keys(accounts).map(key => {
    if (amounts[key] ===  accounts[key].lastAmount) {
      delete amounts[key]
    } else {
      amounts[key] = `${amounts[key]}€  vs  ${accounts[key].lastAmount}€ (expected)`
    }
  })
  console.log(amounts)

  // console.log(dataSheet.usedRange())

  // const r = dataSheet.range("A10195:E10195");
  // r.value([[39448, 39448, 39448, 39448, 39448,]])

  // await workbook.toFileAsync(compteResult);
}

await main();
console.log('DONE!')
process.exit(0)
