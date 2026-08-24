const fs = require('node:fs');
const path = require('node:path');

const projectRoot = fs.realpathSync(path.resolve(__dirname, '..'));
const outputDirectory = path.resolve(projectRoot, '.tmp-mp34');

if (
  path.dirname(outputDirectory) !== projectRoot ||
  path.basename(outputDirectory) !== '.tmp-mp34'
) {
  throw new Error('Diretório temporário MP-34 inválido.');
}

if (fs.existsSync(outputDirectory)) {
  const resolvedOutput = fs.realpathSync(outputDirectory);
  if (
    path.dirname(resolvedOutput) !== projectRoot ||
    path.basename(resolvedOutput) !== '.tmp-mp34'
  ) {
    throw new Error('Diretório temporário MP-34 fora do projeto.');
  }
  fs.rmSync(resolvedOutput, { recursive: true, force: true });
}
