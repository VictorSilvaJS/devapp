const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.resolve(projectRoot, '.tmp-domain-compat');

if (
  path.dirname(outputDirectory) !== projectRoot
  || path.basename(outputDirectory) !== '.tmp-domain-compat'
) {
  throw new Error('Diretório temporário de contratos inválido.');
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
