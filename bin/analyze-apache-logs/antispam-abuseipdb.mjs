// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'
import fs from 'fs'

// https://docs.abuseipdb.com/#blacklist-endpoint

// return stopforumspam data related to ips in data
/*
async function getBlacklist() {
  const headers = {
    'Accept': 'application/json',
    'Key': 'XXX',   // remove this hardcoded value
    'confidenceMinimum':'90',
  }
  const querystring = {
    'confidenceMinimum':'90'
  }
  const url = 'https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=30'
  let rawDatas = {}
  try {
    const response = await fetch(url, {headers: headers});
    rawDatas = await response.json();
  } catch {
  }
  return rawDatas
}
*/

async function getBlacklist() {
  const rawDatas = await JSON.parse(fs.readFileSync('C:\\Users\\pasca\\Desktop\\blacklist.txt', 'utf8'))
  let result = []
  rawDatas.data.forEach(element => {
    result[element.ipAddress] = element
  });
  return result
}

// jsonObject is the returned info from stopforumspam.org, typically
// {
//   value: '104.168.153.70',
//   appears: 1,
//   frequency: 17,
//   lastseen: '2023-12-17 10:39:57',
//   delegated: 'us',
//   asn: 54290,
//   country: 'us',
//   confidence: 79.07
// }

// TODO: return a status about unknown, crawler, spam...
// function ipStatus(jsonObject) {
//   if (jsonObject === undefined) {
//     console.log(jsonObject)
//     return true
//   }
//   if ((jsonObject.appears > 0) && (jsonObject.confidence > 0)) {
//     // TODO: use a confidence threshold
//     // TODO: use lastseen
//     return false
//   } else {
//     return true
//   }
// }

// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

function ipStatus(jsonObject) {
  if (jsonObject === undefined) {
    return true
  }
  return false
}

export default {
  getBlacklist,
  ipStatus,
}
