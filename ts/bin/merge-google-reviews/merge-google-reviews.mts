#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License


import * as fs from 'fs'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'


function getArgs(argv: string[]) {
  let options = yargs(hideBin(argv))
    .usage('node bin/merge-google-reviews.mjs --last-reviews /f/90\\ -\\ SAVE/account.google.com/pascal.brand38/all-reviews.json  /f/90\\ -\\ SAVE/account.google.com/pascal.brand38/Fiche\\ d_établissement\\ Google/account-110841691470593763216/location-11788348530846541886/reviews*.json')
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .demandCommand(1)   // 1 or more arg without options, which are the current reviews
    .options({
      "last-reviews": {
        description: "the last review file, containing all reviews",
        requiresArg: true,
        required: true,
        type: 'string',
      },
    })
    .check((argv: any) => {
      return true;
    }).strict()   // raise an error if an option is unknown
    .parseSync();

  return options;
}

export interface googleReviewType {
    reviewer: {
      displayName: string,
    },
    starRating: string,
    comment?: string,       // in case of a single note, on comment is providec
    createTime: string,
    updateTime: string,
    name: string,
}
export interface googleReviewsType {
  reviews: googleReviewType[],
}



export async function mergeGoogleReviews() {
  const options = getArgs(process.argv)
  const oldReviews: googleReviewsType = JSON.parse(fs.readFileSync(options['last-reviews'], 'utf8'));
  const newReviews: googleReviewsType = { reviews: [] }
  let stats = { new: 0, updated: 0, removed: 0, total: 0 }

  options['_'].forEach(newReviewFilename => {
    const currentReviews: googleReviewsType = JSON.parse(fs.readFileSync(newReviewFilename, 'utf8'));
    currentReviews.reviews.forEach(review => {
      stats.total ++
      newReviews.reviews.push(review)
      let sameIndex = oldReviews.reviews.findIndex(r => r.createTime === review.createTime)
      if (sameIndex === -1) {     // new review
        stats.new ++
      } else {
        // already there - may be updated
        if (oldReviews.reviews[sameIndex].updateTime !== review.updateTime) {
          stats.updated ++
        }
        oldReviews.reviews.splice(sameIndex, 1)
      }
    })
  })

  stats.removed = oldReviews.reviews.length
  if (stats.removed !== 0) {
    console.log('Here are the removed reviews:')
    console.log(oldReviews.reviews)
    console.log()
  }

  console.log(`Number of reviews:         ${stats.total}`)
  console.log(`Number of new reviews:     ${stats.new}`)
  console.log(`Number of updated reviews: ${stats.updated}`)
  console.log(`Number of removed reviews: ${stats.removed}`)

  // sort the reviews by newest
  newReviews.reviews.sort((a, b) => -(a.createTime.localeCompare(b.createTime)))

  // save the new list
  const text = JSON.stringify(newReviews, null, ' ')
  fs.writeFileSync(options['last-reviews'], text)
}


// {
//   "reviews": [{
//     "reviewer": {
//       "displayName": "My Name"
//     },
//     "starRating": "FIVE",
//     "comment": "Nous avons laissé ...(Translated by Google)\nWe left...",
//     "createTime": "2025-02-06T16:18:39.709250Z",
//     "updateTime": "2025-02-06T16:18:39.709250Z",
//     "name": "accounts/1108.../locations/117.../reviews/ChZD..."
//   }, {
//   ...
//   }]
// }
