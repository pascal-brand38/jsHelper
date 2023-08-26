/// Copyright (c) Pascal Brand
/// MIT License

import { PDFDocument } from 'pdf-lib'
import fs from 'fs'



// async - load PDF file from its filename, and extract the form
async function load(pdfFullName) {
  const pdf = await PDFDocument.load(fs.readFileSync(pdfFullName));
  return pdf
}

async function loadObject(pdfFullName, init=undefined) {
  const pdf = await load(pdfFullName);
  const form = pdf.getForm();
  let result = {
    pdf: pdf, 
    form: form
  }
  if (init !== undefined) {
    init(result)
  }
  return result
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

export default {
  load,           // async - load PDF file from its filename
  flatten,
  getFields,
  decomposeFields,

  loadObject,       // async - load pdf and form from its filename - return { pdf, form }
  getTextfieldAsInt,
}
