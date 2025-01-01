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

  rows.forEach((row, index) => {
    if (index < 5) {
      return    // title of columns
    }
    const account = row[0]
    const initDate = row[1]   // all the same date
    const initAmount = row[2] ? row[2] : 0
    const type1 = row[3]    // immo / liquidites
    const type2 = row[4]    // compte courant, livrets,...
    const type3 = row[5]    // court terme, long terme,...

    if (account) {
      accounts[account] = {}
      accounts[account].init = initAmount
      accounts[account].initDate = initDate
      accounts[account].lastUpdate = initDate
      accounts[account].amount = initAmount
      accounts[account].lastAmount = 0
      accounts[account].type1 = type1
      accounts[account].type2 = type2
      accounts[account].type3 = type3
    }
  })

  getLastAmounts(workbook, accounts)
  return accounts
}

function createResume(workbook, accounts) {
  const dataSheet = workbook.sheet("Résumé")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()
  console.log(dataRange)

  // clean the rows, apart the title
  rows.forEach((row, index) => {
    if (index < 5) {
      return    // title of columns
    }
    rows[index] = [ '', '', '' ]
  })

  let currentRow = 4
  let lastType2 = undefined
  Object.keys(accounts).map(key => {
    if (accounts[key].amount !== 0) {
      if (accounts[key].type2 !== lastType2) {
        lastType2 = accounts[key].type2
        currentRow++
      }
      rows[currentRow] = [ key, accounts[key].amount, accounts[key].lastUpdate ]
      currentRow++
    }
  })


  dataRange.value(rows)
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
      accounts[account].amount = Math.round(accounts[account].amount * 100) / 100
      if (accounts[account].lastUpdate < date) {
        accounts[account].lastUpdate = date
      }
    }
  })

  const amounts = {}
  Object.keys(accounts).map(key => {
    if (accounts[key].amount !==  accounts[key].lastAmount) {
      amounts[key] = `${amounts[key]}€  vs  ${accounts[key].lastAmount}€ (expected)`
    }
  })
  console.log(amounts)

  // console.log(dataSheet.usedRange())

  // const r = dataSheet.range("A10195:E10195");
  // r.value([[39448, 39448, 39448, 39448, 39448,]])

  createResume(workbook, accounts)


  await workbook.toFileAsync(compteResult);
}

await main();
console.log('DONE!')
process.exit(0)
