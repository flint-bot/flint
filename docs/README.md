## Rebuilding Docs

The `build.sh` script in this folder generates the README.md for the project.
This build script requires that you have installed the dev dependencies of this project.

```bash
#!/bin/bash

JSDOC="$(pwd)/../node_modules/jsdoc-to-markdown/bin/cli.js"
README="$(pwd)/../README.md"

cat header.md > ${README}

cat example1.md >> ${README}
cat example2.md >> ${README}

cat overview.md >> ${README}
cat installation.md >> ${README}

${JSDOC} ../lib/flint.js ../lib/bot.js >> ${README}

cat license.md >> ${README}
```
