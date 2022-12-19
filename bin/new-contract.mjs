// Based on pdf-lib
//   npm install pdf-lib

// from https://pdf-lib.js.org/#fill-form


import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
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
        description: "",
        requiresArg: true,
        required: true
      },
      "to": {
        description: "",
        requiresArg: true,
        required: true
      },
      "priceday": {
        description: "",
        requiresArg: true,
        required: true
      },
      "nbdays": {
        description: "",
        requiresArg: true,
        required: true
      },
      "services": {
        description: "",
        requiresArg: true,
        required: true
      },
      "total": {
        description: "",
        requiresArg: true,
        required: true
      },
      "accompte": {
        description: "",
        requiresArg: true,
        required: true
      },
      "date_accompte": {
        description: "",
        requiresArg: true,
        required: true
      },
      "solde": {
        description: "",
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

function getCurrentContractDir(rootDir, who) {
  const reWhoCompta = /[\s]+\/.*/;    // look for 1st slash, and remove the remaining
  const catCompta = who.replace(reWhoCompta, '');

  const subdirs = getImmediateSubdirs(rootDir);
  var candidates = [];
  const reWhoDir = /[\s]+-.*/;    // look for 1st dash, and remove the remaining
  subdirs.forEach((subdir) => {
    const catDir = subdir.replace(reWhoDir, '')
    if (catDir === catCompta) {
      candidates.push(subdir);
    }
  })

  if (candidates.length === 0) {
    error('Impossible de trouver le répertoire de contrat de ' + catCompta);
  } else if (candidates.length > 1) {
    error('Plusieurs chats s\'appellent ' + catCompta + '\n' + candidates)
  }

  return candidates[0];
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

  const textFieldsToCopy = [
    'Nom Prénom',
    'Adresse 1',
    'Adresse 2',
    'Téléphone',
    'Adresse email',
    'Personne autre que moi à prévenir en cas durgence',
    'Téléphone_2',
    '1',
    '2',
    'undefined',
    'Leucose FELV',
    'Typhus coryza RCP',
    'Oui Non Si oui lesquelles',
  ];
  textFieldsToCopy.forEach(text => {
    formNewContract.getTextField(text).setText(formLastContract.getTextField(text).getText());
  })

  const checkBoxFieldsToCopy = [
    'Mâle',
    'Femelle',
    'undefined_2',
    'undefined_3',
  ];
  checkBoxFieldsToCopy.forEach(text => {
    if (formLastContract.getCheckBox(text).isChecked()) {
      formNewContract.getCheckBox(text).check();
    }
  });

  formNewContract.getTextField('Date darrivée').setText(options.from);
  formNewContract.getTextField('Date de départ').setText(options.to);
  formNewContract.getTextField('Nombre de jours').setText(options.nbdays.toString());
  formNewContract.getTextField('Tarif Journalier').setText(options.priceday + '€');
  formNewContract.getTextField('Total du séjour avec services').setText(options.total + '€');
  formNewContract.getTextField('Acompte de 30  à la réservation').setText((options.accompte==='') ? ('0€') : (options.accompte + '€'));
  formNewContract.getTextField('versé le').setText(options.date_accompte);
  formNewContract.getTextField('Le solde de la pension sera versé le jour de larrivée soit').setText(options.solde + '€');
  formNewContract.getTextField('Services soins santé arrivéedépart dimanche').setText((options.services==='') ? ('0€') : (options.services));
  
  // get new contract name
  const reContractName = /^[0-9]*[a-z]?[\s]*-[\s]*/;    // remove numbers (dates) 4 times
  var newContrat = lastContract;
  newContrat = newContrat.replace(reContractName, '');
  newContrat = newContrat.replace(reContractName, '');
  newContrat = newContrat.replace(reContractName, '');
  const fromParts = options.from.split("/");
  newContrat = fromParts[2] + ' - ' + fromParts[1] + ' - ' + fromParts[0] + ' - ' + newContrat;
  newContrat = currentContractDir + '\\' + newContrat

  child_process.exec('explorer ' + currentContractDir);
  try {
    fs.writeFileSync(newContrat, await pdfNewContract.save(), { flag: 'wx' });
  } catch(e) {
    console.log(e);
    error("Impossible d'écrire le fichier   " + options.rootDir + '\\' + newContrat);
  }
  child_process.exec('explorer ' + newContrat);

}


function main() {
  const options = get_args();
  const currentContractDir = options.rootDir + '\\' + getCurrentContractDir(options.rootDir, options.who);
  const lastContract = getLastContract(currentContractDir);

  updatePDF(options, currentContractDir, lastContract)
}


main();
