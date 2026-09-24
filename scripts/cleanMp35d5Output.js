const fs = require('node:fs');
const path = require('node:path');
const root = fs.realpathSync(path.resolve(__dirname, '..'));
const target = path.resolve(root, '.tmp-mp35d5');
if (fs.existsSync(target)) {
  const resolved = fs.realpathSync(target);
  if (path.dirname(resolved) !== root || path.basename(resolved) !== '.tmp-mp35d5') {
    throw new Error('Diretório temporário D-5 fora do projeto.');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
