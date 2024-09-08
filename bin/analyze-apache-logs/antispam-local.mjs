// Copyright (c) Pascal Brand
// MIT License

// data is the apache data from logs - see apache-data.mjs
// db is the ip database - see db-ip.mjs

import dns from 'dns'

const antispam = 'local'

function _dnsReverseAsync(ipAddress) {
  return new Promise(resolve => {
    try {
      dns.reverse(ipAddress, (err, hostnames) => {
        resolve({ err: err, hostnames: hostnames })
      })
    } catch {
      resolve({ err: 'Exception' })
    }
  })
}


// return nb of secs from a time which is typically '26/Dec/2023:07:58:22 +0100'
function _getNbSecs(time) {
  const fields = time.split(/[ :]/) // fields = [ '26/Dec/2023', '07', '58', '22', '+0100']
  return (parseInt(fields[1])*60 + parseInt(fields[2])) * 60 + parseInt(fields[3])
}

async function spamDetection(apacheData) {
  const results = await Promise.all(apacheData.uniqueIps.map(async ip => {
    const requests = apacheData.logs.filter((l) => (l.remoteHost === ip))
    let reason = 'strange'

    // spam no request to a html file succeeds
    if (requests.every(r => {
      if ((r.status === '200') && (r.request.startsWith('GET '))) {
        const v = r.request.split(' ')
        const page = v[1].split('?')
        if ((page[0] === '/') || (page[0].endsWith('html'))) {
          return false
        }
      }
      return true
    })) {
      return apacheData.spamDetected(ip, 'no html requests succeed', antispam)
    }

    // spam when requesting a wrong page, or robots,...
    if (requests.some((r, index) => {
      if (r.status === '404') {
        if (['GET /wp-', 'GET /wordpress'].some(wp => r.request.startsWith(wp))) {
          reason = 'accessing wordpress files'
          return true
        }

        // check forbidden pages
        // ads.txt: who is able to sell my ads. Only spammers/crawler looks at it!
        if (['GET /ads.txt'].some(wp => r.request.startsWith(wp))) {
          reason = 'accessing wrong files'
          return true
        }
      }
      if (r.request.startsWith('GET /robots.txt ')) {
        reason = 'accessing robots.txt'
        return true
      }

      // immediate post
      if (r.request.startsWith('POST ') && (index >= 1)) {
        const secsPrev = _getNbSecs(requests[index-1].time)
        const secs = _getNbSecs(r.time)

        if (secs - secsPrev < 10) {   // less than 10secs between the page arrives, and the post
          reason = 'immediate post contact form'
          return true
        }
      }

      if (r['RequestHeader User-Agent'].toLowerCase().includes('bot')) {    // TODO: not relialable
        reason = `user-agent contains bot word: ${r['RequestHeader User-Agent']}`
        return true
      }
      return false
    })) {
      return apacheData.spamDetected(ip, reason, antispam)
    }

    const detected = await _dnsReverseAsync(ip).then(res => {
      // console.log(`${ip} ${res.hostnames} ${res.err}`)
      if (!res.err) {
        if (res.hostnames.some(h => {
          if (h.endsWith('googlezip.net')) {
            reason = `hostname contains 'googlezip.net': ${h}`
            return true
          }
          return false
        })) {
          return apacheData.spamDetected(ip, reason, antispam)
        }
      }
      return undefined
    })
    if (detected) {
      return detected
    }

    return apacheData.noSpam(ip, antispam)
  }))

  console.log('PASCAL')
  console.log(results)
  apacheData.filter(results)
}

export default {
  spamDetection,
}
