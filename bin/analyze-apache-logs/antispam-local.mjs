// Copyright (c) Pascal Brand
// MIT License

// data is the apache data from logs - see apache-data.mjs
// db is the ip database - see db-ip.mjs

import dns from 'dns'

function dnsReverseAsync(ipAddress) {
  return new Promise(resolve => {
    dns.reverse(ipAddress, (err, hostnames) => {
      console.log(err)
      resolve({ err: err, hostnames: hostnames })
    })
  })
}


// return nb of secs from a time which is typically '26/Dec/2023:07:58:22 +0100'
function _getNbSecs(time) {
  const fields = time.split(/[ :]/) // fields = [ '26/Dec/2023', '07', '58', '22', '+0100']
  return (parseInt(fields[1])*60 + parseInt(fields[2])) * 60 + parseInt(fields[3])
}

function _setValue(local, key, value) {
  if (local === undefined) {
    local = {}
  }
  local[key] = value
  return local
}

async function get(apacheData) {
  let result = {}

  await Promise.all(apacheData.uniqueIps.map(async ip => {
    let local = undefined
    const requests = apacheData.logs.filter((l) => (l.remoteHost === ip))

    // check a html request succeeded
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
      local = _setValue(local, 'noGetHtmlSuccess', 'TODO')
    }

    // single request to '/' which is odd
    const slashRequest = 'GET / HTTP/1.1'
    if (requests.length === 1) {
      if ((requests[0].status === '200') && (requests[0].request === slashRequest)) {
        local = _setValue(local, 'singleRequestToSlash', 'TODO')
      }
    } else if (requests.length === 2) {
      if ((requests[0].status === '301') && (requests[0].request === slashRequest) &&
          (requests[1].status === '200') && (requests[1].request === slashRequest)) {
        local = _setValue(local, 'singleRequestToSlash', 'TODO')
      }
    }

    requests.forEach((r, index) => {
      if (r.status === '404') {
        if (['GET /wp-', 'GET /wordpress'].some(wp => r.request.startsWith(wp))) {
          local = _setValue(local, 'wordpress', 'TODO')
        }
        // check forbidden pages
        // ads.txt: who is able to sell my ads. Only spammers/crawler looks at it!
        if (['GET /ads.txt'].some(wp => r.request.startsWith(wp))) {
          local = _setValue(local, 'forbiddenPage', 'TODO')
        }
      }
      if (r.request.startsWith('GET /robots.txt ')) {
        local = _setValue(local, 'robots', 'TODO')
      }
      if (r['RequestHeader User-Agent'].toLowerCase().includes('bot')) {    // TODO: not relialable
        local = _setValue(local, 'uaContainsBot', r['RequestHeader User-Agent'])
      }

      // immediate post
      if (r.request.startsWith('POST ') && (index >= 1)) {
        const secsPrev = _getNbSecs(requests[index-1].time)
        const secs = _getNbSecs(r.time)

        if (secs - secsPrev < 10) {   // less than 10secs between the page arrives, and the post
          local = _setValue(local, 'immediatePost', 'TODO')
        }
      }
    })
    if (local === undefined) {
      await dnsReverseAsync(ip).then(res => console.log(res))
      //dnsReverseAsync(ip)
    }
    //if (local = == undefined) {
  // const res = await Promise.all(promises);
  // res.forEach(r => {
  //   console.log(r)
  //   // if (r.err) {
  //   //   console.log(`err: ${r.err}`)
  //   // } else {
  //   //   console.log(`hostnames: ${r.hostnames}`)
  //   // }
  //})

        // dns.reverse(ip, (err, hostnames) => {
        //   if (err) {
        //     console.log(`err: ${ip} ${err}`)
        //   } else {
        //     console.log(`hostnames: ${ip} ${hostnames}`)
        //   }
        // })
  })

  // const promises = apacheData.uniqueIps.map(ip => dnsReverseAsync(ip));
  // const res = await Promise.all(promises);
  // res.forEach(r => {
  //   console.log(r)
  //   // if (r.err) {
  //   //   console.log(`err: ${r.err}`)
  //   // } else {
  //   //   console.log(`hostnames: ${r.hostnames}`)
  //   // }
  //})
  )

  console.log('RETURN')
  return result
}


function ipStatus(jsonObject) {
  if (jsonObject === undefined) {
    return true
  }
  if ((jsonObject.wordpress !== undefined) ||
      (jsonObject.robots !== undefined) ||
      (jsonObject.uaContainsBot !== undefined) ||
      (jsonObject.immediatePost !== undefined) ||
      (jsonObject.noGetHtmlSuccess !== undefined) ||
      (jsonObject.singleRequestToSlash !== undefined) ||
      (jsonObject.forbiddenPage !== undefined) ||
      false) {
    return false
  } else {
    return true
  }
}

// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

export default {
  get,
  ipStatus,
}
