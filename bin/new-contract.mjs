/// Copyright (c) Pascal Brand
/// MIT License
///
// Based on pdf-lib
//   npm install pdf-lib
//
// from https://pdf-lib.js.org/#fill-form
//
// Check pdf validity using:
//    - https://www.pdf-online.com/osa/validate.aspx
//
//    - Convert to pdf/A (from https://stackoverflow.com/questions/1659147/how-to-use-ghostscript-to-convert-pdf-to-pdf-a-or-pdf-x)
//      and then check manually the results, if all fields are correct
//      /c/Program\ Files/gs/gs10.00.0/bin/gswin64.exe -dPDFA -dBATCH -dNOPAUSE -sProcessColorModel=DeviceRGB -sDEVICE=pdfwrite -sPDFACompatibilityPolicy=1 -sOutputFile=output_filename.pdf input_filename.pdf
//
//    - Check ghoscript console to see if there can be errors (like more fonts than expected)
//        /c/Program\ Files/gs/gs10.00.0/bin/gswin64.exe -r36x36 file.pdf
//      a single 'Loading font Helvetica' must appear
//
//    Do not use the followings which are too simple (look for count page,...):
//        https://www.npmjs.com/package/is-pdf-valid
//        https://www.npmjs.com/package/@ninja-labs/verify-pdf
//        https://www.npmjs.com/package/ghostscript-node




import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import { PDFDocument, PDFName, PDFBool, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import { exit } from 'process';
import child_process from 'child_process'
import {decode} from 'html-entities';


function error(s) {
  console.log('***');
  console.log('***  ERREUR');
  console.log('*** ', s);
  console.log('***');

  exit(-1)
}

function get_args() {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  var options = yargs
    .usage('Create a contract from an excel compta macro directly\n\nUsage: $0 [options]')
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "root-dir": {
        description: "directory that contains all contract directories, as well as the blank contract",
        requiresArg: true,
        required: true
      },
      "blank-contract": {
        description: "<filename.pdf> of the blank contract",
        requiresArg: true,
        required: true
      },
      "who": {
        description: "who in the compta. Contains cat's name and owner's name",
        requiresArg: true,
        required: true
      },

      "from": {
        description: "Starting date, format dd/mm/yyyy",
        requiresArg: true,
        required: true
      },
      "to": {
        description: "End date, format dd/mm/yyyy",
        requiresArg: true,
        required: true
      },
      "priceday": {
        description: "Price per day, without the ??? sign",
        requiresArg: true,
        required: true
      },
      "nbdays": {
        description: "Nb of days",
        requiresArg: true,
        required: true
      },
      "services": {
        description: "Services to be included",
        requiresArg: true,
        required: true
      },
      "total": {
        description: "Total price",
        requiresArg: true,
        required: true
      },
      "accompte": {
        description: "Accompte asked for",
        requiresArg: true,
        required: true
      },
      "date_accompte": {
        description: "Date of the accompte if already paid",
        requiresArg: true,
        required: true
      },
      "solde": {
        description: "Amount on arrival date",
        requiresArg: true,
        required: true
      },
      
    })
    .argv;
  
  options.who = decode(options.who)
  options.services = decode(options.services)

  return options;
}

function getImmediateSubdirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);
}

function getCurrentContractDir(rootDir, who, returnList=false) {
  const reDoubleSpace = /[\s]{2,}/g;
  const reSlash = /\//g;
  const reTrailing = /[\s]+$/g;
  const reStarting = /^[\s]+/g;
  who = who
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
    .replace(reDoubleSpace, ' ')
    .replace(reTrailing, '')
    .replace(reStarting, '')
    .replace(reSlash, '-')
    .toLowerCase();  // so now who does contain neither accents nor double-space nor slash (replace with dash)
  var candidates;

  // 1st method: look if who and subdir are a prefix of the other after / and accents and double-space removal
  candidates = [];
  const subdirs = getImmediateSubdirs(rootDir);
  subdirs.forEach((subdir) => {
    var subdirProcessed = subdir
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
      .replace(reDoubleSpace, ' ')
      .replace(reTrailing, '')
      .replace(reStarting, '')
      .replace(reSlash, '-')
      .toLowerCase();  // so now who does contain neither accents nor double-space nor slash (replace with dash)

    if (subdirProcessed.startsWith(who) || who.startsWith(subdirProcessed)) {
      candidates.push(subdir);
    }
  })
  if (candidates.length == 1) {
    if (returnList) {
      // for testing only
      return candidates;
    } else {
      return candidates[0];
    }
  }

  // 3rd method: look for catname only
  const reCatNameExtract = /[\s]+-.*/;    // look for 1st dash, and remove the remaining
  const catCompta = who.replace(reCatNameExtract, '');

  candidates = [];
  subdirs.forEach((subdir) => {
    var subdirProcessed = subdir
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
      .replace(reDoubleSpace, ' ')
      .replace(reTrailing, '')
      .replace(reStarting, '')
      .replace(reSlash, '-')
      .toLowerCase()
      .replace(reCatNameExtract, '');  // so now who does contain neither accents nor double-space nor slash (replace with dash)
    if (subdirProcessed === catCompta) {
      candidates.push(subdir);
    }
  })

  if (returnList) {
    return candidates;
  } else {
    if (candidates.length === 0) {
      error('Impossible de trouver le r??pertoire de contrat de ' + catCompta);
    } else if (candidates.length > 1) {
      error('Plusieurs chats s\'appellent ' + catCompta + '\n' + candidates)
    }

    return candidates[0];
  }
}


function getLastContract(dir) {
  const all_files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.startsWith('20'))
    .map((item) => item.name);
  if (all_files.length == 0) {
    error('Aucun contrat existant dans ' + dir)
  }
  return all_files[all_files.length - 1];
}


// Set a form field, and update appearance fontToUse on this field
function updateTextField(form, fieldText, value, fontToUse) {
  let f = form.getTextField(fieldText);
  f.setText(value);
  f.updateAppearances(fontToUse)
}

async function updatePDF(options, currentContractDir, lastContract) {
  const pdfLastContract = await PDFDocument.load(fs.readFileSync(currentContractDir + '\\' + lastContract));
  const formLastContract = pdfLastContract.getForm();

  if (true) {
    console.log('printing...')
    const fieldsLastContract = formLastContract.getFields()
    fieldsLastContract.forEach(field => {
      const type = field.constructor.name;
      const name = field.getName();
      console.log(type + '     ' + name);
    });
  }

  const pdfNewContract = await PDFDocument.load(fs.readFileSync(options.rootDir + '\\' + options.blankContract));
  const formNewContract = pdfNewContract.getForm();

  // cf. https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedfont
  // const helvetica = await pdfNewContract.embedFont(StandardFonts.Helvetica)
  pdfNewContract.registerFontkit(fontkit)
  //const fontToUse = await pdfNewContract.embedFont(fs.readFileSync('C:\\Windows\\Fonts\\ARLRDBD.TTF'))
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fontToUse = await pdfNewContract.embedFont(fs.readFileSync(path.join(__dirname, 'Helvetica.ttf')))

  const textFieldsToCopy = [
    [ 'Nom Pr??nom' ],   // list of equivalent field name - 1st one is the one in the new contract
    [ 'Adresse 1' ],
    [ 'Adresse 2' ],
    [ 'T??l??phone' ],
    [ 'Adresse email' ],
    [ 'Personne autre que moi ?? pr??venir en cas durgence', 'Personne ?? pr??venir en cas durgence' ],
    [ 'T??l??phone_2' ],
    [ '1' ],
    [ '2' ],
    [ 'undefined' ],
    [ 'Leucose FELV' ],
    [ 'Typhus coryza RCP' ],
    [ 'Oui Non Si oui lesquelles' ],
  ];
  textFieldsToCopy.forEach(field => {
    let value = '';
    field.forEach(text => {
      try {
        value = formLastContract.getTextField(text).getText();
        console.log(value);
      } catch {
        // cannot have it
      }
    });
    
    updateTextField(formNewContract, field[0], value, fontToUse)
  })

  const checkBoxFieldsToCopy = [
    [ 'M??le' ],
    [ 'Femelle' ],
    [ 'undefined_2' ],
    [ 'undefined_3' ],
  ];
  checkBoxFieldsToCopy.forEach(field => {
    field.forEach(text => {
      try {
        if (formLastContract.getCheckBox(text).isChecked()) {
          formNewContract.getCheckBox(field[0]).check();
        }
      } catch {
        // cannot have it
      }
    })
  });

  const reservations = [
    [ 'Date darriv??e', options.from ],
    [ 'Date de d??part', options.to ],
    [ 'Nombre de jours', options.nbdays.toString() ],
    [ 'Tarif Journalier', options.priceday + '???' ],
    [ 'Total du s??jour avec services', options.total + '???' ],
    [ 'Acompte de 30  ?? la r??servation', (options.accompte==='') ? ('0???') : (options.accompte + '???') ],
    [ 'vers?? le', options.date_accompte ],
    [ 'Le solde de la pension sera vers?? le jour de larriv??e soit', options.solde + '???' ],
    [ 'Services soins sant?? arriv??ed??part dimanche', (options.services==='') ? ('0???') : (options.services) ],
  ]
  reservations.forEach(resa => updateTextField(formNewContract, resa[0], resa[1], fontToUse))

  // get new contract name
  const reContractName = /^[0-9]*[a-z]?[\s]*-[\s]*/;    // remove numbers (dates) 4 times
  var newContrat = lastContract;
  newContrat = newContrat.replace(reContractName, '');
  newContrat = newContrat.replace(reContractName, '');
  newContrat = newContrat.replace(reContractName, '');
  const fromParts = options.from.split("/");
  newContrat = fromParts[2] + ' - ' + fromParts[1] + ' - ' + fromParts[0] + ' - ' + newContrat;
  newContrat = currentContractDir + '\\' + newContrat

  // following is causing some isses when opening it with Adobe DC - shows some squares
  // https://github.com/Hopding/pdf-lib/issues/569#issuecomment-1087328416
  // update needappearance field
  //pdfNewContract.getForm().acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True)


  child_process.exec('explorer ' + currentContractDir);
  try {
    const pdfBuf = await pdfNewContract.save(/*{ updateFieldAppearances: true }*/)
    fs.writeFileSync(newContrat, pdfBuf, { flag: 'wx' });
  } catch(e) {
    console.log(e);
    error("Impossible d'??crire le fichier   " + options.rootDir + '\\' + newContrat);
  }
  child_process.exec('explorer ' + newContrat);

}


function testContractDir() {
  // copy/paste from the compta excel sheet  -  to be updated
  const comptaWho = [
    'Isis / Dupond ',
    'Luna / Durand',
  ];
  const base = 'XXX'
  const rootDir = 'C:\\Users\\pasca\\Desktop\\' + base + '\\Contrat Clients ' + base;
  comptaWho.forEach(who => {
    const candidates = getCurrentContractDir(rootDir, who, true);
    if (candidates.length != 1) {
      console.log(who);
    }
  })
}

function main() {
  const options = get_args();
  const currentContractDir = options.rootDir + '\\' + getCurrentContractDir(options.rootDir, options.who);
  const lastContract = getLastContract(currentContractDir);

  updatePDF(options, currentContractDir, lastContract)
}


main();
// testContractDir()    // uncomment to test
                        // update this function with up-to-date who list from compta excel file
