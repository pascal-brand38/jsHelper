#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import { analyzeApacheLogs } from '../js/bin/analyze-apache-logs/analyze-apache-logs.mjs'

await analyzeApacheLogs();
console.log('DONE!')
