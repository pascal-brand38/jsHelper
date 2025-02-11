#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import { mergeGoogleReviews } from '../js/bin/merge-google-reviews/merge-google-reviews.mjs'

await mergeGoogleReviews();
console.log('DONE!')
