import globalJsdom from 'jsdom-global'
globalJsdom()
let DOMParser = window.DOMParser

import SMS from './SMS.mjs'
import MMS from './MMS.mjs'

let input, file, fr, doc, parser;
let loaded = false; //`loaded` prevents spamming site with same file on multiclick

function init() {
  if (typeof (DOMParser) == 'undefined') {
    console.log('DOMParser')
    DOMParser = function () { }
      DOMParser.prototype.parseFromString = function (str, contentType) {
          if (typeof (ActiveXObject) != 'undefined') {
            console.log('ActiveXObject')
              let xmldata = new ActiveXObject('MSXML.DomDocument');
              xmldata.async = false;
              xmldata.loadXML(str);
              return xmldata;
          } else if (typeof (XMLHttpRequest) != 'undefined') {
              let xmldata = new XMLHttpRequest;
              if (!contentType) {
                  contentType = 'application/xml';
              }
              xmldata.open('GET', 'data:' + contentType + ';charset=utf-8,' + encodeURIComponent(str), false);
              if (xmldata.overrideMimeType) {
                  xmldata.overrideMimeType(contentType);
              }
              xmldata.send(null);
              return xmldata.responseXML;
          }
      }
  }

  let xmlString = "<root><thing attr='val'/></root>";
  parser = new DOMParser();
  doc = parser.parseFromString(xmlString, "text/xml");
}

function showMessages(xmlText) {
  console.log('showMessage')
    doc = parser.parseFromString(xmlText, "text/xml");

    let currentElement = doc['childNodes'][2]['firstElementChild'];
    let messages = [];

    while (currentElement != null) {
        let messageType = currentElement.tagName;

        switch(messageType) {
            case "sms":
                let sms = new SMS(currentElement);
                messages.push(sms.getMessage());
                break;

            case "mms":
                let mms = new MMS(currentElement);
                messages.push(mms.getMessage());
                break;
        }

        currentElement = currentElement['nextElementSibling'];
    }

    messages.sort(function(x, y){
        let add0 = x[0]["nodeValue"];
        let add1 = x[0]["nodeValue"];
        if(add0 != add1) {
            return add0 - add1;
        }

        return x[1]["nodeValue"] - y[1]["nodeValue"];
    });

    let container = document.getElementById("container");
    messages.forEach(function(message) {
        let hr = document.createElement("hr");
        document.getElementById("container").appendChild(hr);

        container.appendChild(message[2]);
    });
}

export default {
  init,
  showMessages,
}
