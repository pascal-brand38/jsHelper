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
    requests.forEach(r => {
      if (r.status === '404') {
        if (r.request.startsWith('GET /wp-')) {
          local = _setValue(local, 'wordpress', 'TODO')
        }
      }
      if (r.status === '200') {
        if (r.request.startsWith('GET /robots.txt ')) {
          local = _setValue(local, 'robots', 'TODO')
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
  if ((jsonObject.wordpress !== undefined) || (jsonObject.robots !== undefined)) {
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
