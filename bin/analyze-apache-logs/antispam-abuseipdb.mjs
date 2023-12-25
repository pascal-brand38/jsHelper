// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'
import fs from 'fs'

// https://docs.abuseipdb.com/#blacklist-endpoint

// return stopforumspam data related to ips in data
async function getBlacklist() {
  const headers = {
    'Accept': 'application/json',
    'Key': 'XXX',   // remove this hardcoded value
  }
  const params = new URLSearchParams();
  params.append('confidenceMinimum', 90);

  const url = 'https://api.abuseipdb.com/api/v2/blacklist'
  let rawDatas = {}
  try {
    const response = await fetch(url, { headers: headers, body: params });
    rawDatas = await response.json();
  } catch {
    console.log('abuseipdb RETURNED AN ERROR')
    return {}
  }

  // save it just in case
  fs.writeFileSync('C:\\tmp\\blacklist.txt', JSON.stringify(rawDatas))

  if (rawDatas.errors !== undefined) {
    console.log('CANNOT READ abuseipdb RESULT')
    console.log(rawDatas)
    return {}
  }

  let result = []
  rawDatas.data.forEach(element => {
    result[element.ipAddress] = element
  });
  return result
}

// async function getBlacklist() {
//   const rawDatas = await JSON.parse(fs.readFileSync('C:\\Users\\pasca\\Desktop\\blacklist.txt', 'utf8'))
//   let result = []
//   rawDatas.data.forEach(element => {
//     result[element.ipAddress] = element
//   });
//   return result
// }


function ipStatus(jsonObject) {
  return !((jsonObject) && (jsonObject.abuseConfidenceScore !== undefined) && (jsonObject.abuseConfidenceScore>=30))
}

export default {
  getBlacklist,
  ipStatus,
}
