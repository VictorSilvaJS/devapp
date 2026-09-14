const fs = require('node:fs');
const path = require('node:path');
const projectRoot = fs.realpathSync(path.resolve(__dirname, '..'));
const output = path.resolve(projectRoot, '.tmp-mp35d4');
if (path.dirname(output) !== projectRoot || path.basename(output) !== '.tmp-mp35d4') {
  throw new Error('Diretório temporário D-4 inválido.');
}
if (fs.existsSync(output)) {
  const resolved = fs.realpathSync(output);
  if (path.dirname(resolved) !== projectRoot || path.basename(resolved) !== '.tmp-mp35d4') {
    throw new Error('Diretório temporário D-4 fora do projeto.');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
