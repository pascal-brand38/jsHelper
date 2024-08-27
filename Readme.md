# Installation

* install nodejs
* npm -g install .


# Executables and utilities

## merge-mbox

Utility used when using google takout archives of emails.
Instead of saving monthly each mbox files, which are huge,
and contains similar emails, merge-mbox is used to merge 2
mbox files: the new one, and the one containing all the
emails from the start, to create the new
_all emails from the start_ file, without duplicate emails.

```bash
merge-mbox \
  --last-mbox=latest-takeout.mbox \
  --all-mbox=all-time-emails.mbox \
  --result-mbox=all-time-emails.mbox
```

## save-on-cloud

Utility used when archives of google drive are stored.
Saving monthly your google drive entirely takes a huge amount
of space as most of the files are the same and are not moved.

Instead, save-on-cloud will save your current file if not
already archived:
* If already archived and not the same,
  the previous version is saved under _.save-with-dates_
  directory suffixed with the date.
* and if already archived, and is the same, then nothing
  is done!

Using options ```-remove-moved-files```, files that are in
dstDir, and not in srcDir, but which have a copy somewhere in
srcDir, are removed as that means they have been moved.

```bash
save-on-cloud
  --src-dir=google-drive \
  --dst-dir=archive-dir  \
  --remove-moved-files
```

## rm-duplicates

Utility used to remove files in a directory that are duplicated
in another one. By default, exact comparison of files is
performed, and is a dry-run so that no mistake is performed

Possible options are:
* --nameonly: check for name only, instead of file content
* --remove: instead of a dry-run, remove the duplicated files
* --move: instead of a dry-run, move the duplicated files
  in a temporary directory

```bash
rm-duplicates \
  --src-dir="C:\Users\pasca\Pictures" \
  --dup-dir="C:\tmp"
```


## analyse-apache-logs

## Utilities for the cattery

Specific executables used by the cattery. They cannot really be useful for anybody else
as they are really specific:
* check-agenda
* check-contrat
* envoi-contrat
* livre-entrees-sorties
* new-contract
* new-customer
* thanks
