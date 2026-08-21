const fs = require('node:fs');
const path = require('node:path');

function resolvedProjectRoot(projectRoot) {
  return fs.realpathSync(path.resolve(projectRoot));
}

function assertTemporaryRoot(projectRoot) {
  const project = resolvedProjectRoot(projectRoot);
  const temporaryRoot = path.resolve(projectRoot, '.tmp-mp33c');
  if (
    path.dirname(temporaryRoot) !== path.resolve(projectRoot) ||
    path.basename(temporaryRoot) !== '.tmp-mp33c'
  ) {
    throw new Error('Diretório temporário MP-33C inválido.');
  }
  if (!fs.existsSync(temporaryRoot)) {
    fs.mkdirSync(temporaryRoot, { recursive: false });
  }
  const resolvedTemporaryRoot = fs.realpathSync(temporaryRoot);
  if (path.dirname(resolvedTemporaryRoot) !== project) {
    throw new Error('Diretório temporário MP-33C fora do projeto.');
  }
  return { temporaryRoot, resolvedTemporaryRoot };
}

function removeTemporaryChild(projectRoot, childName) {
  const { temporaryRoot, resolvedTemporaryRoot } =
    assertTemporaryRoot(projectRoot);
  const target = path.resolve(temporaryRoot, childName);
  if (!target.startsWith(temporaryRoot + path.sep)) {
    throw new Error('Alvo temporário MP-33C inválido.');
  }
  if (fs.existsSync(target)) {
    const resolvedTarget = fs.realpathSync(target);
    if (!resolvedTarget.startsWith(resolvedTemporaryRoot + path.sep)) {
      throw new Error('Alvo temporário MP-33C fora do projeto.');
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
  return target;
}

function removeTemporaryRoot(projectRoot) {
  const temporaryRoot = path.resolve(projectRoot, '.tmp-mp33c');
  if (!fs.existsSync(temporaryRoot)) return;
  const project = resolvedProjectRoot(projectRoot);
  const resolvedTemporaryRoot = fs.realpathSync(temporaryRoot);
  if (
    path.dirname(resolvedTemporaryRoot) !== project ||
    path.basename(temporaryRoot) !== '.tmp-mp33c'
  ) {
    throw new Error('Diretório temporário MP-33C fora do projeto.');
  }
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

module.exports = { removeTemporaryChild, removeTemporaryRoot };
