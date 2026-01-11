// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'

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

async function spamDetection(apacheData) {
  const ipsToCheck = apacheData.userIps.filter(ip => !apacheData.spamCheckToday(ip, 'stopforumspam'))
  const chunkSize = 15;   // stopforumspam sends 15 ip information at a time

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  let urls = []
  for (let i = 0; i < ipsToCheck.length; i += chunkSize) {
    let chunk = ipsToCheck.slice(i, i + chunkSize);
    if (chunk.length === 1) {
      chunk.push('0.0.0.0')   // add an extra one to ensure the result is a list
    }
    urls.push('https://api.stopforumspam.org/api?json&ip=' + chunk.join('&ip='))
  }

  let spamIps = []
  await Promise.all(urls.map(async (url) => {
    try {
      await fetch(url)
        .then(response =>response.json())
        .then(rawDatas => {
          if (rawDatas.success === 1) {
            rawDatas.ip.forEach(element => {
              if (element.appears === 1) {  // only the ones that show a spam
                spamIps.push(apacheData.spamDetected(element.value, 'detected', 'stopforumspam'))
              } else {
                spamIps.push(apacheData.noSpam(element.value, 'stopforumspam'))
              }
            })
          }
        })
      } catch {

      }
  }))

  apacheData.filter(spamIps)
}

// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

export default {
  spamDetection,
}
