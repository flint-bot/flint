#!/bin/bash

JSDOC="$(pwd)/../node_modules/jsdoc-to-markdown/bin/cli.js"
DOCTOC="$(pwd)/../node_modules/doctoc/doctoc.js"
README="$(pwd)/../README.md"

cat header.md > ${README}
cat installation.md >> ${README}
cat example1.md >> ${README}
cat overview.md >> ${README}

${DOCTOC} --github --notitle --maxlevel 4 ${README}

echo -e "\n# Flint Reference\n\n" >> ${README}

${JSDOC} ../lib/flint.js ../lib/bot.js >> ${README}

cat license.md >> ${README}
