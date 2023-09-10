/// Copyright (c) Pascal Brand
/// MIT License

import { PDFDocument } from 'pdf-lib'
import pdfjs from 'pdfjs-dist'   // https://github.com/mozilla/pdf.js
import fs from 'fs'

function getTextfieldAsInt(pdfObject, field) {
  const result = pdfObject.form.getFieldMaybe(field)
  if (result === undefined) {
    return undefined
  } else {
    return parseInt(result.getText())
  }
}

// from https://github.com/Hopding/pdf-lib/issues/602
// get the size of the form field
function getRectsFromField(field,doc) {
	var widgets = (
		field
		.acroField.getWidgets()
	)
	
	if(doc) {
		return widgets.map(q=>{
			var rect = q.getRectangle()
			var pageNumber = doc
				.getPages()
				.findIndex(x => x.ref == q.P())
			rect.pageNumber = pageNumber;
			return rect;
		})
	} else 
		return widgets.map(q=>q.getRectangle());
}

// load a pdf file, and return a pdf object that contain the following properties:
// - pdf: the pdf as a pdj-lib.js structure
// - form: the form
// - helper: set of extra data obtained from the form
//   - pdfFullName
//   - version: version of the pdf document
//   - errors: list of errors encountered when extracting data - empty when no error
// moreover, if init is provided, then the pdf object may be populated with a version for example
async function _load(pdfFullName, init=undefined) {
  const pdf = await PDFDocument.load(fs.readFileSync(pdfFullName));
  const form = pdf.getForm();
  let pdfObject = {
    pdf: pdf, 
    form: form,
    helper: {
      pdfFullName: pdfFullName,
      version: undefined,
      errors: [],
      warnings: [],
    },
  }
  if (init !== undefined) {
    init(pdfObject)
  }
  return pdfObject
}

async function _save(pdfObject, pdfFullName, flag={ flag: 'wx' }) {
  const pdfBuf = await pdfObject.pdf.save(/*{ updateFieldAppearances: true }*/)
  fs.writeFileSync(pdfFullName, pdfBuf, flag);
}

const helperProp = 'helper'

// TODO COMMENTS
// setPropFromFields: set propertys inside the helperProp property

function setPropFromFields(pdfObject, setPropFromFieldsDatas, postproc, result=undefined) {
  if (result === undefined) {
    result = pdfObject[helperProp]
  }
  setPropFromFieldsDatas.forEach(data => {
    if (data.hasOwnProperty('setPropFromFieldsDatas')) {
      const prop = data['prop']
      result[prop] = {}
      setPropFromFields(pdfObject, data['setPropFromFieldsDatas'], undefined, result[prop])
    } else {
      data.method(pdfObject, data.prop, data.args, result)
    }
  })

  if (postproc !== undefined) {
    postproc(pdfObject, result)
  }
}

function _setProplistFromTextfieldlist(pdfObject, prop, args, result) {
  result[prop] = []
  args.forEach(arg => {
    result[prop].push(pdfObject.form.getTextField(arg).getText())
  })
}

function _setProplistlistFromTextfieldlistlist(pdfObject, prop, args, result) {
  result[prop] = []
  args.forEach(arg => {
    let n = []
    arg.forEach(a => {
      n.push(pdfObject.form.getTextField(a).getText())
    })
    result[prop].push(n)
  })
}

function _setProplistFromChecklist(pdfObject, prop, args, result) {
  result[prop] = []
  args.forEach(arg => {
    result[prop].push(pdfObject.form.getCheckBox(arg).isChecked())
  })
}

// set a textfield, or a list of text fields
function _setTextfield(pdfObject, Textfield, text, fontToUse=undefined) {
  const f = pdfObject.form.getTextField(Textfield);
  f.setText(text);
  if (fontToUse !== undefined) {
    f.updateAppearances(fontToUse)
  }
}

function _setTextfields(pdfObject, Textfields, texts, fontToUse=undefined) {
  texts.forEach((text, index) => _setTextfield(pdfObject, Textfields[index], text, fontToUse))
}


// check to true all field in checks list
function _checks(pdfObject, checks) {
  checks.forEach(f => pdfObject.form.getCheckBox(f).check())  
}

function addText(pdfObject, text) {
  const page = pdfObject.pdf.getPage(0)
  const { width, height } = page.getSize()
  const fontSize = 11
  page.drawText(text, {
    x: width - (text.length)*fontSize,
    y: height - 10 * fontSize,
    size: fontSize,
    //font: timesRomanFont,
    //color: rgb(0, 0.53, 0.71),
  })
}


async function pdfjsLoad(pdfFullName) {
  const loadingTask = pdfjs.getDocument(pdfFullName);
  return await loadingTask.promise.then(doc => doc)
}

async function pdfjsGetMetadata(doc) {
  const metadata = await doc.getMetadata()
  console.log("# Metadata Is Loaded");
  console.log("## Info");
  console.log(JSON.stringify(metadata.info, null, 2));
  console.log();
  if (metadata.metadata) {
    console.log("## Metadata");
    console.log(JSON.stringify(metadata.metadata.getAll(), null, 2));
    console.log();
  }
}

async function pdfjsGetText(doc) {
  const numPages = doc.numPages;
  const nPageArray = Array.from({length: numPages}, (_, i) => i + 1)    // [ 1 ... numPages ]
  let texts = []

  console.log(`nPageArray = ${nPageArray}`)
  await Promise.all(nPageArray.map(async (num) => { 
    const page = await doc.getPage(num)
    const textContent = await page.getTextContent()
    textContent.items.forEach(item => texts.push(item.str))
    await page.cleanup();
  }))

  return texts
}


export default {
  pdflib: {
    // from https://pdf-lib.js.org/ - to get/set forms
    // https://pdf-lib.js.org/#fill-form
    load: _load,    // async
    save: _save,    // async
    flatten: (pdfObject => pdfObject.form.flatten()),
    helperProp: helperProp,
    setPropFromFields: setPropFromFields,
    setProplistFromTextfieldlist: _setProplistFromTextfieldlist,
    setProplistlistFromTextfieldlistlist: _setProplistlistFromTextfieldlistlist,
    setProplistFromChecklist: _setProplistFromChecklist,
    checks: _checks,
    setTextfield: _setTextfield,
    setTextfields: _setTextfields,
    addText: addText,
    getTextfieldAsInt,
  },

  // TODO: object-oriented way
  pdfjs: {
    // from https://github.com/mozilla/pdf.js - to get/set text
    // check at https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.js
    // API: https://github.com/mozilla/pdf.js/blob/master/src/display/api.js
    load: pdfjsLoad,    // async
    getMetadata: pdfjsGetMetadata,
    getText: pdfjsGetText,
  }
}
