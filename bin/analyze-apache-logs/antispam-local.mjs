// Copyright (c) Pascal Brand
// MIT License

// data is the apache data from logs - see apache-data.mjs
// db is the ip database - see db-ip.mjs

const antispam = 'local'

// return nb of secs from a time which is typically '26/Dec/2023:07:58:22 +0100'
function _getNbSecs(time) {
  const fields = time.split(/[ :]/) // fields = [ '26/Dec/2023', '07', '58', '22', '+0100']
  return (parseInt(fields[1])*60 + parseInt(fields[2])) * 60 + parseInt(fields[3])
}

async function spamDetection(apacheData, options) {
  const results = await Promise.all(apacheData.userIps.map(async ip => {
    const requests = apacheData.logs.filter((l) => (l.remoteHost === ip))
    let reason = 'strange'

    if (requests.length <= 2) {
      // TODO: weak
      return apacheData.spamDetected(ip, 'Only 2 requests for this ip', antispam)
    }

    // same user-agent
    // different user-agent may occur when the user is looking with google and then with firefox!
    const ua = requests[0]['RequestHeader User-Agent']
    if (requests.some(r => { reason = r['RequestHeader User-Agent']; return reason !== ua })) {
      return apacheData.spamDetected(ip, `Not always the same user-agent: ${reason} !== ${ua}`, antispam)
    }

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

    // check access to files reserved for bots
    const getBotsOnly =  options.config.local.get.botsOnly
    let getFilenames = []
    Object.keys(getBotsOnly).forEach(key => {
      if (!key.startsWith('comment')) {
        getFilenames = [ ...getFilenames, ...getBotsOnly[key] ]
      }
    })
    if (requests.some(r => {
      if (getFilenames.some(wp => { reason = r.request; return reason.startsWith('GET /' + wp) })) {
        return true
      } else {
        return false
      }
    })) {
      return apacheData.spamDetected(ip, `Accessing a file indicating a bot or a spammer: ${reason}`, antispam)
    }

    // check forbidden keywords in user agent
    const uaBotsOnly =  options.config.local.userAgent.botsOnly
    let uaText = []
    Object.keys(uaBotsOnly).forEach(key => {
      if (!key.startsWith('comment')) {
        uaText = [ ...uaText, ...uaBotsOnly[key] ]
      }
    })
    if (requests.some(r => {
      if (uaText.some(wp => { reason = r['RequestHeader User-Agent']; return reason.toLowerCase().includes(wp.toLowerCase()) })) {
        return true
      } else {
        return false
      }
    })) {
      return apacheData.spamDetected(ip, `User Agent indicates a bot or a spammer: ${reason}`, antispam)
    }


    // spam when requesting a wrong page, or robots,...
    if (requests.some((r, index) => {
      // immediate post
      if (r.request.startsWith('POST ') && (index >= 1)) {
        const secsPrev = _getNbSecs(requests[index-1].time)
        const secs = _getNbSecs(r.time)

        if (secs - secsPrev < 10) {   // less than 10secs between the page arrives, and the post
          reason = 'immediate post contact form'
          return true
        }
      }

      return false
    })) {
      return apacheData.spamDetected(ip, reason, antispam)
    }

    return apacheData.noSpam(ip, antispam)
  }))

  apacheData.addSpamIps(results.filter(r=>r.isSpam).map(r => r.ip))

  // apacheData.saveLogsUser('C:/tmp/toto.log')
}

export default {
  spamDetection,
}
