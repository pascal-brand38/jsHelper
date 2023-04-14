/// Copyright (c) Pascal Brand
/// MIT License
///
// Based on pdf-lib
//   npm install pdf-lib
//




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
    .usage('Open thinderbird to send a THANKS email, from an excel compta macro directly\n\nUsage: $0 [options]')
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "root-dir": {
        description: "directory that contains all contract directories, as well as the blank contract",
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
      "entreprise": {
        description: "Enterprise name",
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
      error('Impossible de trouver le répertoire de contrat de ' + catCompta);
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



async function sendMail(options, currentContractDir, lastContract) {
  const pdfLastContract = await PDFDocument.load(fs.readFileSync(currentContractDir + '\\' + lastContract));
  const formLastContract = pdfLastContract.getForm();

  let email
  try {
    email = formLastContract.getTextField('Adresse email').getText();
  } catch {
    error('Impossible de connaitre l\'email de ' + options.who)
  }

  // email = 'toto@gmail.com'
  const reCatNameExtract = /[\s]+[-/].*/;    // look for 1st dash, and remove the remaining
  const catName = options.who.replace(reCatNameExtract, '');


  let exe = '"C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe"'
  let to = 'to=\'' + email + '\''
  // let subject = '"subject=\'' + encodeURIComponent('Merci de ééé') + '\'  '
  let subject = 'subject=' + encodeURI('Merci pour votre acompte')
  let body = ""
  body += 'Bonjour,\n\n'
  body += 'J\'ai bien reçu l\'acompte de ' + options.accompte + '€ pour les vacances de ' + catName + ' à ' + options.entreprise + ' du ' + options.from + ' au ' + options.to + '.\n\n'
  body += 'En vous remerciant,'
  body = 'body=' + encodeURIComponent(body)

  let cmd = exe + ' -compose ' + '"' 
    + to + ',' + subject + ',' + body
    + '"'
  // console.log(cmd)
  child_process.exec(cmd)
  // child_process.exec('C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe -compose "to=\'toto@gmail.com\'"')
}


function main() {
  const options = get_args();
  const currentContractDir = options.rootDir + '\\' + getCurrentContractDir(options.rootDir, options.who);
  const lastContract = getLastContract(currentContractDir);

  sendMail(options, currentContractDir, lastContract)
}


main();
