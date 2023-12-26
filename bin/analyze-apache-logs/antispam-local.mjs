// Copyright (c) Pascal Brand
// MIT License

// data is the apache data from logs - see apache-data.mjs
// db is the ip database - see db-ip.mjs

function _setValue(local, key, value) {
  if (local === undefined) {
    local = {}
  }
  local[key] = value
  return local
}
async function get(apacheData) {
  let result = {}
  apacheData.uniqueIps.forEach(ip => {
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
    if ((requests.length === 1) && (requests[0].request === 'GET / HTTP/1.1')) {
      local = _setValue(local, 'singleRequestToSlash', 'TODO')
    }

    requests.forEach((r, index) => {
      if (r.status === '404') {
        if (['GET /wp-', 'GET /wordpress'].some(wp => r.request.startsWith(wp))) {
          local = _setValue(local, 'wordpress', 'TODO')
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
        const prev = requests[index-1]
        if (r.time === prev.time) {
          local = _setValue(local, 'immediatePost', 'TODO')
        }
      }
    })
    if (local !== undefined) {
      result[ip] = local
      if (local.uaContainBot !== undefined) {
        console.log(`${local.robots}  -  ${local.uaContainBot}`)
      }
    }
  })

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
