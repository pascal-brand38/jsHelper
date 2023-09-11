// Copyright (c) Pascal Brand
// MIT License
//
// Extension of pdfjs-dist package
// - from https://github.com/mozilla/pdf.js - to get/set text
// - check at https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.js
// - API: https://github.com/mozilla/pdf.js/blob/master/src/display/api.js
//
// Extension includes:
//    const doc = await pdfjsLib.load(filename)
//    const texts = doc.getText()

import pdfjsLib from 'pdfjs-dist'

// load a pdf document
async function _load(pdfFullName) {
  const loadingTask = pdfjsLib.getDocument(pdfFullName);
  let doc = await loadingTask.promise.then(doc => doc)

  // https://stackoverflow.com/questions/1592384/adding-prototype-to-javascript-object-literal
  // use this way as the type of doc, which is PDFDocumentProxy, is not exported by pdfjs-dist
  Object.setPrototypeOf(doc, {
    getText: _getText
  })
  return doc
}

// get all texts, as a list
async function _getText() {
  const numPages = this.numPages;
  const nPageArray = Array.from({length: numPages}, (_, i) => i + 1)    // [ 1 ... numPages ]
  let texts = []

  await Promise.all(nPageArray.map(async (num) => { 
    const page = await this.getPage(num)
    const textContent = await page.getTextContent()
    textContent.items.forEach(item => texts.push(item.str))
    await page.cleanup();
  }))

  return texts
}

pdfjsLib.load = _load
export default pdfjsLib
