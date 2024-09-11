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

function _checkLog(apacheData, requests, botsOnly, logField, textReason, fctToCheck) {
  let logText
  let configTexts = []
  Object.keys(botsOnly).forEach(key => {
    if (!key.startsWith('comments-')) {
      configTexts = [...configTexts, ...botsOnly[key]]
    }
  })
  if (requests.some(r => {
    if (configTexts.some(configText => { logText = r[logField]; return fctToCheck(logText, configText) })) {
      return true
    } else {
      return false
    }
  })) {
    return apacheData.spamDetected(requests[0].remoteHost, `${textReason}: ${logText}`, antispam)
  }
  return undefined
}

async function spamDetection(apacheData, options) {
  let spam=undefined
  const results = apacheData.userIps.map(ip => {
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
    spam = _checkLog(
      apacheData, requests,
      options.config.local.get.botsOnly, 'request', 'Accessing a file indicating a bot or a spammer',
      (logText, configText) => logText.startsWith('GET /' + configText))
    if (spam !== undefined) {
      return spam
    }

    // check forbidden keywords in user agent
    spam = _checkLog(
      apacheData, requests,
      options.config.local.userAgent.botsOnly, 'RequestHeader User-Agent', 'User Agent indicates a bot or a spammer',
      (logText, configText) => logText.toLowerCase().includes(configText.toLowerCase()))
    if (spam !== undefined) {
      return spam
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
  })

  apacheData.addSpamIps(results.filter(r=>r.isSpam).map(r => r.ip))

  // apacheData.saveLogsUser('C:/tmp/toto.log')
}

export default {
  spamDetection,
}
