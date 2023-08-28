/// Copyright (c) Pascal Brand
/// MIT License

import { PDFDocument } from 'pdf-lib'
import fs from 'fs'



// async - load PDF file from its filename, and extract the form
async function load(pdfFullName) {
  const pdf = await PDFDocument.load(fs.readFileSync(pdfFullName));
  return pdf
}


async function flatten(pdf, fullName) {
  pdf.getForm().flatten()
  try {
    const pdfBuf = await pdf.save(/*{ updateFieldAppearances: true }*/)
    fs.writeFileSync(fullName, pdfBuf, { flag: 'w' });
    return true
  } catch(e) {
    console.log(e);
    return false
  }
}

function getFields(pdf, fieldsMatch) {
  const form = pdf.getForm();

  let result = {}
  fieldsMatch.forEach(item => {
     const type = item.type
     const prop = item.prop
     const fields = item.fields
     switch (type) {
      case 'T':
        result[prop] = ''
        fields.every(field => {
          try {
            result[prop] = form.getTextField(field).getText();
            if (result[prop] === undefined) {
              result[prop] = ''
            }
            return false    // found - stop the every function
          } catch {
            return true     // not found - continue
          }
        })
        break
      case 'C':
        result[prop] = false
        fields.every(field => {
          try {
            result[prop] = form.getCheckBox(field).isChecked();
            return false    // found - stop the every function
          } catch {
            return true     // not found - continue
          }
        })
        break
      default:
        // oops - should never be the case
      }

  })

  return result
}

function decomposeFields(fields, fieldsMatch, excludes=[]) {
  let results = {}
  fieldsMatch.forEach(field => {
    if (!excludes.includes(field['prop'])) {
      if (field['decompose'] === undefined) {
        results[field['prop']] = fields[field['prop']]
      } else {
        field['decompose'](field['prop'], fields[field['prop']], results)
      }
    }
  })
  return results
}

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

// load a pdf file, and return a pdf object that contain:
// - pdf: the pdf as a pdj-lib.js structure
// - form: the form
// - pdfFullName
// moreover, if init is provided, then the pdf object may be populated with a version for example
async function _load(pdfFullName, init=undefined) {
  const pdf = await PDFDocument.load(fs.readFileSync(pdfFullName));
  const form = pdf.getForm();
  let pdfObject = {
    pdf: pdf, 
    form: form,
    pdfFullName: pdfFullName,
  }
  if (init !== undefined) {
    init(pdfObject)
  }
  return pdfObject
}

async function _save(pdfObject, pdfFullName) {
  const pdfBuf = await pdfObject.pdf.save(/*{ updateFieldAppearances: true }*/)
  fs.writeFileSync(pdfFullName, pdfBuf, { flag: 'wx' });
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


export default {
  load,           // async - load PDF file from its filename
  flatten,
  getFields,
  decomposeFields,

  getTextfieldAsInt,

  pdflib: {
    load: _load,    // async
    save: _save,    // async
    checks: _checks,
    setTextfield: _setTextfield,
    setTextfields: _setTextfields,
  }
}
