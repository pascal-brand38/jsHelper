#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import {flattenMboxes} from '../js/bin/flatten-mboxes/flatten-mboxes.mjs'

await flattenMboxes();
console.log('DONE!')
