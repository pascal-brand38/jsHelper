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

async function spamDetection(apacheData) {
  const ipsToCheck = apacheData.uniqueIps.filter(ip => !apacheData.spamCheckToday(ip, 'abuseipdb'))

  const headers = {
    'Accept': 'application/json',
    'Key': '21157626c3e8a195c3747de65569463c12421d9d825673aa41e77a525fe44bc995cdb5d5e552de84',   // remove this hardcoded value
  }
  const url = 'https://api.abuseipdb.com/api/v2/check?'

  let spamIps = []
  await Promise.all(ipsToCheck.map(async (ip) => {
    try {
      const params = new URLSearchParams({
        ipAddress: ip,
        maxAgeInDays: '183',
      })

      await fetch(url + params, { headers: headers })
        .then(response =>response.json())
        .then(rawDatas => {
          console.log(rawDatas)
              if (rawDatas.data.abuseConfidenceScore > 0) {  // only the ones that show a spam
                spamIps.push(apacheData.spamDetected(ip, 'detected', 'abuseipdb'))
              } else {
                spamIps.push(apacheData.noSpam(ip, 'abuseipdb'))
              }
        })
      } catch {
      }
  }))

  console.log(spamIps)
  apacheData.filter(spamIps)
}

export default {
  getBlacklist,
  ipStatus,
  spamDetection,
}
