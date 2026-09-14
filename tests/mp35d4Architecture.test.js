const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function graph(entry) {
  const files = new Set(); const pending = [path.join(root, entry)];
  while (pending.length) {
    const file = pending.pop(); if (files.has(file)) continue; files.add(file);
    for (const { fileName: specifier } of ts.preProcessFile(fs.readFileSync(file, 'utf8')).importedFiles) {
      if (!specifier.startsWith('.')) continue;
      const base = path.resolve(path.dirname(file), specifier);
      const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (target && /\.[jt]sx?$/.test(target)) pending.push(target);
    }
  }
  return files;
}
test('grafo HTTP alcança D4 sem src/api, mock, seed Demo, storage de negócio ou fila offline', () => {
  const files = graph('src/entry/http.tsx');
  for (const name of ['administrativePropertyCommands', 'administrativePropertyModels',
    'administrativePropertyRepository', 'administrativePropertyCommandLifecycle', 'administrativePropertyDataBoundary']) {
    assert.ok(files.has(path.join(root, `src/http/${name}.ts`)), name);
  }
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    assert.doesNotMatch(relative, /^(?:src\/api|demo)\//);
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /AsyncStorage|mockV2DemoSeed|offlineQueue|fallbackToMock/);
  }
});
test('capacidade visual D4 expõe somente criação e edição administrativas autorizadas', () => {
  const files = ['src/http/HttpNavigation.tsx', ...fs.readdirSync(path.join(root, 'src/http/screens'))
    .filter((file) => /\.tsx$/.test(file)).map((file) => `src/http/screens/${file}`)];
  for (const file of files) assert.doesNotMatch(read(file), /AdministrativeProperty(?:Status|Transfer|Links)/);
  assert.match(read('src/http/HttpNavigation.tsx'), /propertyAccess.allowed \? <Stack.Group/);
  assert.match(read('src/http/HttpNavigation.tsx'), /name="AdministrativePropertyCreate"/);
  assert.match(read('src/http/HttpNavigation.tsx'), /name="AdministrativePropertyEdit"/);
});
test('Demo não recebe a nova administração HTTP e mantém sua composição', () => {
  const files = graph('src/entry/demo.tsx');
  assert.ok([...files].some((file) => file.includes(`${path.sep}api${path.sep}`)));
  for (const file of files) assert.doesNotMatch(path.basename(file), /^administrativeProperty/);
});
test('fronteiras independentes e um único coordenador idempotente no runtime', () => {
  const runtime = read('src/http/runtime.ts');
  assert.equal([...runtime.matchAll(/new AdministrativeCommandCoordinator\(/g)].length, 1);
  assert.equal([...runtime.matchAll(/new AdministrativePropertyDataBoundary\(/g)].length, 1);
  assert.doesNotMatch(read('src/http/administrativePropertyDataBoundary.ts'), /AdministrativeUser|usuario_id/);
  assert.doesNotMatch(read('src/http/administrativeUserDataBoundary.ts'), /AdministrativeProperty/);
  assert.match(runtime, /captureAuthorizationEffects/);
});
test('serviço reutiliza coordenador/transporte e não implementa /me, seletores ou operações fora do corte', () => {
  const service = read('src/http/administrativePropertyCommands.ts');
  assert.match(service, /#coordinator\.execute/);
  assert.doesNotMatch(service, /fetch\(|setTimeout|\/v1\/auth\/me|\/v1\/localidades|DELETE|transferir|fazenda_id/);
  assert.match(read('src/http/administrativePropertyModels.ts'), /normalizeAdministrativeAreaTotal/);
  assert.doesNotMatch(read('src/http/administrativePropertyModels.ts'), /parseFloat|Intl\.NumberFormat|Number\(/);
});
