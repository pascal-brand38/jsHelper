// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'

// data is the apache data from logs - see apache-data.mjs
// db is the ip database - see db-ip.mjs

// return stopforumspam data related to ips in data
async function get(uniqueIps) {
  if (uniqueIps.size === 0) {
    return {}
  }

  // always add ip=0.0.0.0 so that there are at least 2 ips to find, and so result is a list
  const url = 'https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=' + uniqueIps.join('&ip=')
  try {
    const response = await fetch(url);
    const rawDatas = await response.json();
    if (rawDatas.success != 1) {
      return {}
    }
    let result = {}
    rawDatas.ip.forEach(element => {
      result[element.value] = element
    });

    return result
  } catch {
    return { }
  }
}

// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

export default {
  get
}
