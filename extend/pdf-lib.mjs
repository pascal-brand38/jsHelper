// Copyright (c) Pascal Brand
// MIT License
//
// from https://pdf-lib.js.org/ - to get/set forms
// https://pdf-lib.js.org/#fill-form

import { PDFDocument } from 'pdf-lib'
import helperJs from '../helpers/helperJs.mjs';
import fs from 'fs'


// load a pdf file, and return a pdf object that contain the following properties:
// - pdf: the pdf as a pdj-lib.js structure
// - form: the form
// - helper: set of extra data obtained from the form
//   - pdfFullName
//   - version: version of the pdf document
//   - errors: list of errors encountered when extracting data - empty when no error
// moreover, if init is provided, then the pdf object may be populated with a version for example
async function _loadInit(pdfFullName, init=undefined) {
  let pdf = await PDFDocument.load(fs.readFileSync(pdfFullName));

  if (pdf.hasOwnProperty('extend')) {
    helperJs.error('Internal Error in PDFDocument::loadInit() as .extend property already exists in original pdf-lib')
  }

  pdf.extend = {
    fullname: pdfFullName,
    version: undefined,
    errors: [],
    warnings: [],
  }

  if (init !== undefined) {
    init(pdf)
  }
  return pdf
}

async function _saveWrite(pdfFullName, flag={ flag: 'wx' }) {
  const pdfBuf = await this.save(/*{ updateFieldAppearances: true }*/)
  fs.writeFileSync(pdfFullName, pdfBuf, flag);
}

function _addText(text) {
  const page = this.getPage(0)
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

// check to true all fields of checks list
function _checks(checks) {
  const form = this.getForm()
  checks.forEach(f => form.getCheckBox(f).check())
}

function _setPropFromFields(setPropFromFieldsDatas, postproc, result=undefined) {
  if (result === undefined) {
    result = this.extend
  }
  setPropFromFieldsDatas.forEach(data => {
    if (data.hasOwnProperty('setPropFromFieldsDatas')) {
      const prop = data['prop']
      result[prop] = {}
      this.setPropFromFields(data['setPropFromFieldsDatas'], undefined, result[prop])
    } else {
      data.method(this, data.prop, data.args, result)
    }
  })

  if (postproc !== undefined) {
    postproc(this, result)
  }
}

// set a textfield, or a list of text fields
function _setTextfield(Textfield, text, fontToUse=undefined) {
  const f = this.getForm().getTextField(Textfield);
  f.setText(text);
  if (fontToUse !== undefined) {
    f.updateAppearances(fontToUse)
  }
}

function _setTextfields(Textfields, texts, fontToUse=undefined) {
  texts.forEach((text, index) => this.setTextfield(Textfields[index], text, fontToUse))
}

function _getTextfieldAsInt(field) {
  const result = this.getForm().getFieldMaybe(field)
  if (result === undefined) {
    return undefined
  } else {
    return parseInt(result.getText())
  }
}

function _setProplistFromTextfieldlist(pdfObject, prop, args, result) {
  result[prop] = []
  args.forEach(arg => {
    let r = pdfObject.getForm().getTextField(arg).getText()
    if (r === undefined) {
      r = ''
    }
    result[prop].push(r)
  })
}

function _setProplistlistFromTextfieldlistlist(pdfObject, prop, args, result) {
  result[prop] = []
  args.forEach(arg => {
    let n = []
    arg.forEach(a => {
      let r = pdfObject.getForm().getTextField(a).getText()
      if (r === undefined) {
        r = ''
      }
      n.push(r)
    })
    result[prop].push(n)
  })
}

function _setProplistFromChecklist(pdfObject, prop, args, result) {
  result[prop] = []
  args.forEach(arg => {
    result[prop].push(pdfObject.getForm().getCheckBox(arg).isChecked())
  })
}


PDFDocument.loadInit = _loadInit
PDFDocument.prototype.saveWrite = _saveWrite
PDFDocument.prototype.flatten = function() { this.getForm().flatten() }
PDFDocument.prototype.addText = _addText
PDFDocument.prototype.checks = _checks
PDFDocument.prototype.setPropFromFields = _setPropFromFields
PDFDocument.prototype.setTextfield = _setTextfield
PDFDocument.prototype.setTextfields = _setTextfields
PDFDocument.prototype.setTextfields = _setTextfields
PDFDocument.prototype.getTextfieldAsInt = _getTextfieldAsInt
PDFDocument.prototype.getExtend = function () { return this.extend }
PDFDocument.prototype.setError = function (error) { this.extend.errors.push(error) }
PDFDocument.prototype.getErrors = function () { return this.extend.errors }
PDFDocument.prototype.setWarning = function (warning) { this.extend.warnings.push(warning) }
PDFDocument.prototype.getWarnings = function () { return this.extend.warnings }
PDFDocument.prototype.getFullname = function () { return this.extend.fullname }

const setProplist = {
  fromTextfieldlist: _setProplistFromTextfieldlist,
  fromTextfieldlistlist: _setProplistlistFromTextfieldlistlist,
  fromChecklist: _setProplistFromChecklist,

}
export {
  PDFDocument,
  setProplist,
}
