const fs = require('node:fs');
const path = require('node:path');

const projectRoot = fs.realpathSync(path.resolve(__dirname, '..'));
const outputNames = ['.tmp-mp35d2', '.tmp-mp35d2-navigation'];

for (const outputName of outputNames) {
  const outputDirectory = path.resolve(projectRoot, outputName);
  if (
    path.dirname(outputDirectory) !== projectRoot ||
    path.basename(outputDirectory) !== outputName
  ) {
    throw new Error('Diretório temporário MP-35D-2 inválido.');
  }

  if (fs.existsSync(outputDirectory)) {
    const resolvedOutput = fs.realpathSync(outputDirectory);
    if (
      path.dirname(resolvedOutput) !== projectRoot ||
      path.basename(resolvedOutput) !== outputName
    ) {
      throw new Error('Diretório temporário MP-35D-2 fora do projeto.');
    }
    fs.rmSync(resolvedOutput, { recursive: true, force: true });
  }
}
