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

const _filesForBots = [
  'GET /ads.txt', 'GET /robots.txt', 'GET /humans.txt', 'GET /security.txt', 'GET /sitemap',
]
const _filesWordpress = [
  'GET /wp-', 'GET /wordpress',
]
const _filesSystem = [
  'GET /.',
]

const _useragentForBots = [
  'Headless',               // bots do not use a user interface+
  'facebookexternalhit',    // facebook crawler
  'Bot',
  '@', 'https://',          // user-agent may contain how to contact the bot provider
  // 'Go-http-client',
]

async function spamDetection(apacheData) {
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
    if (requests.some(r => {
      if (_filesForBots.some(wp => { reason = r.request; return r.request.startsWith(wp) })) {
        return true
      } else {
        return false
      }
    })) {
      return apacheData.spamDetected(ip, `Accessing files reserved for bots: ${reason}`, antispam)
    }

    // check access to files reserved for wordpress
    if (requests.some(r => {
      if (_filesWordpress.some(wp => { reason = r.request; return r.request.startsWith(wp) })) {
        return true
      } else {
        return false
      }
    })) {
      return apacheData.spamDetected(ip, `Accessing files from wordpress: ${reason}`, antispam)
    }

    // check access to files reserved for system
    if (requests.some(r => {
      if (_filesSystem.some(wp => { reason = r.request; return r.request.startsWith(wp) })) {
        return true
      } else {
        return false
      }
    })) {
      return apacheData.spamDetected(ip, `Accessing files reserved to system: ${reason}`, antispam)
    }

    // check forbidden keywords in user agent
    if (requests.some(r => {
      if (_useragentForBots.some(wp => { reason = r['RequestHeader User-Agent']; return reason.toLowerCase().includes(wp.toLowerCase()) })) {
        return true
      } else {
        return false
      }
    })) {
      return apacheData.spamDetected(ip, `Forbidden keyword in user-agent: ${reason}`, antispam)
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
