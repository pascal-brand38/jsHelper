// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'
import fs from 'fs'

// requests return something like
// {
//   "success": true,
//   "message": "Success",
//   "fraud_score": 94,
//   "country_code": "FR",
//   "region": "Ile-de-France",
//   "city": "Paris",
//   "ISP": "Scaleway",
//   "ASN": 12876,
//   "organization": "Scaleway",
//   "is_crawler": false,
//   "timezone": "Europe\/Paris",
//   "mobile": false,
//   "host": "178-233-15-51.instances.scw.cloud",
//   "proxy": true,
//   "vpn": true,
//   "tor": false,
//   "active_vpn": false,
//   "active_tor": false,
//   "recent_abuse": true,
//   "bot_status": true,
//   "connection_type": "Premium required.",
//   "abuse_velocity": "Premium required.",
//   "zip_code": "N\/A",
//   "latitude": 48.85907745,
//   "longitude": 2.29348612,
//   "request_id": "JrO3s2qlSt"
// }

// https://www.ipqualityscore.com/api/json/ip/DJcK0cFyVvqBhR4RYqqsELIxHz0clzja/51.15.233.178

async function spamDetection(apacheData) {
  const ipsToCheck = apacheData.uniqueIps.filter(ip => !apacheData.spamCheckToday(ip, 'ipqualityscore'))

  const url = 'https://www.ipqualityscore.com/api/json/ip/DJcK0cFyVvqBhR4RYqqsELIxHz0clzja/'

  let spamIps = []
  await Promise.all(ipsToCheck.map(async (ip) => {
    try {
      const responseFecth = await fetch(url + ip)
      const json = await responseFecth.json()
      if (json.fraud_score > 0) {  // only the ones that show a spam
        spamIps.push(apacheData.spamDetected(ip, `fraud_score=${json.fraud_score} - host=${json.host}`, 'ipqualityscore'))
      } else {
        spamIps.push(apacheData.noSpam(ip, 'ipqualityscore'))
      }
    } catch {
    }
  }))

  console.log(spamIps)
  apacheData.filter(spamIps)
}

export default {
  spamDetection,
}
