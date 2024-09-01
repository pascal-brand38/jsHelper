// Copyright (c) Pascal Brand
// MIT License
//
// Initial version from https://github.com/JumiDeluxe/SMS-XML-backup-reader

import globalJsdom from 'jsdom-global'
globalJsdom()

import SMS from './SMS.mjs'
import MMS from './MMS.mjs'

function showMessages(xmlText) {
  let DOMParser = window.DOMParser
  let parser = new DOMParser();

  console.log('--- Parse the XML structure')
  let doc = parser.parseFromString(xmlText, "text/xml");

    let currentElement = doc['childNodes'][2]['firstElementChild'];
    let messages = [];
    let nSms = 0
    let nMms = 0

    console.log('--- Reading all messages sms/mms')
    while (currentElement != null) {
      if ((messages.length % 200) === 0) {
        console.log(`--- --- #${messages.length} found`)
      }

        let messageType = currentElement.tagName;

        switch(messageType) {
            case "sms":
                nSms++
                let sms = new SMS(currentElement);
                messages.push(sms.getMessage());
                break;

            case "mms":
                nMms++
                let mms = new MMS(currentElement);
                messages.push(mms.getMessage());
                break;
        }

        currentElement = currentElement['nextElementSibling'];
    }
    console.log(`--- --- #sms: ${nSms}`)
    console.log(`--- --- #mms: ${nMms}`)

    messages.sort(function(x, y){
        let add0 = x[0]["nodeValue"];
        let add1 = x[0]["nodeValue"];
        if(add0 != add1) {
            return add0 - add1;
        }

        return x[1]["nodeValue"] - y[1]["nodeValue"];
    });

    console.log('--- Generating the DOM')
    let container = document.getElementById("container");
    messages.forEach(function(message, index) {
      if ((index % 200) === 0) {
        console.log(`--- --- #${index} / #${messages.length}`)
      }
        let hr = document.createElement("hr");
        document.getElementById("container").appendChild(hr);

        container.appendChild(message[2]);
    });
}

export default {
  showMessages,
}
