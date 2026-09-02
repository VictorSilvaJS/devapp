const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function staticGraph(entry) {
  const pending = [entry];
  const visited = new Set();
  const pattern = /import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) {
      const resolved = resolveLocal(file, match[1]);
      if (resolved !== null) pending.push(resolved);
    }
  }
  return visited;
}

test('grafo HTTP com fundação administrativa não alcança Demo, mock ou AsyncStorage', () => {
  const graph = staticGraph(path.join(root, 'src/entry/http.tsx'));
  const files = [...graph].map((file) => path.relative(root, file).replaceAll('\\', '/'));
  assert.ok(files.includes('src/http/administrativeCommandCoordinator.ts'));
  assert.equal(files.some((file) => file.startsWith('src/api/')), false);
  assert.equal(files.some((file) => /mock/i.test(file)), false);
  for (const file of graph) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /AsyncStorage|@react-native-async-storage/);
  }
});

test('grafo administrativo não alcança mock, src/api, storage ou fila offline', () => {
  const graph = staticGraph(
    path.join(root, 'src/http/administrativeCommandCoordinator.ts'),
  );
  const files = [...graph].map((file) =>
    path.relative(root, file).replaceAll('\\', '/'));
  assert.equal(files.some((file) => file.startsWith('src/api/')), false);
  assert.equal(files.some((file) => /mock/i.test(file)), false);
  for (const file of graph) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /AsyncStorage|SecureStore|@react-native-async-storage|offline[_ -]?queue/i,
    );
  }
});

test('coordenador usa UUID nativo seguro sem storage, log ou expo-crypto', () => {
  const coordinator = source('src/http/administrativeCommandCoordinator.ts');
  assert.match(coordinator, /globalThis as ExpoUuidGlobal/);
  assert.match(coordinator, /expo\?\.uuidv4/);
  assert.doesNotMatch(
    coordinator,
    /Math\.random|expo-crypto|AsyncStorage|SecureStore|console\.|logger\.|src\/api/,
  );
  assert.match(coordinator, /canonicalBody: canonical\.serialized/);
  assert.match(coordinator, /Object\.freeze\(\{/);
  assert.match(coordinator, /this\.#session\.authenticated/);
});

test('execute captura input antes do await e finaliza somente a entrada interna esperada', () => {
  const coordinator = source('src/http/administrativeCommandCoordinator.ts');
  const executeStart = coordinator.indexOf('  async execute<T>');
  const beginStart = coordinator.indexOf('\n  #begin(', executeStart);
  const executeSource = coordinator.slice(executeStart, beginStart);
  const afterAwait = executeSource.slice(executeSource.indexOf('await '));
  assert.match(executeSource, /captureAdministrativeCommandInput\(input\)/);
  assert.doesNotMatch(afterAwait, /input\./);
  assert.match(coordinator, /readonly token: object/);
  assert.match(coordinator, /current === entry/);
  assert.match(coordinator, /current\.token === entry\.token/);
  assert.match(coordinator, /this\.#settle\(entry,/);
});

test('canonicalização JSON é limitada, incremental e usa descritores individuais', () => {
  const coordinator = source('src/http/administrativeCommandCoordinator.ts');
  assert.match(coordinator, /Reflect\.ownKeys\(value\)/);
  assert.match(coordinator, /Object\.getOwnPropertyDescriptor\(value,/);
  assert.doesNotMatch(coordinator, /Object\.getOwnPropertyDescriptors/);
  assert.match(coordinator, /new WeakSet\(\)/);
  assert.match(coordinator, /descriptor\.value/);
  assert.doesNotMatch(coordinator, /value\[index\]/);
  assert.doesNotMatch(coordinator, /Object\.entries/);
  assert.doesNotMatch(coordinator, /JSON\.stringify/);
  assert.match(coordinator, /MAX_CANONICAL_BODY_BYTES = 64 \* 1_024/);
  assert.match(coordinator, /MAX_BODY_DEPTH = 32/);
  assert.match(coordinator, /MAX_JSON_NODES = 4_096/);
  assert.match(coordinator, /MAX_JSON_OBJECT_PROPERTIES = 512/);
  assert.match(coordinator, /MAX_JSON_ARRAY_ELEMENTS = 1_024/);
  assert.match(coordinator, /MAX_JSON_STRING_CODE_UNITS = 65_536/);
  assert.match(coordinator, /MAX_JSON_KEY_CODE_UNITS = 1_024/);

  const stringStart = coordinator.indexOf('function appendJsonString(');
  const nodeStart = coordinator.indexOf('\nfunction consumeNode(', stringStart);
  const stringSource = coordinator.slice(stringStart, nodeStart);
  assert.ok(stringSource.indexOf('value.length + 2 > writer.remaining') >= 0);
  assert.ok(
    stringSource.indexOf('value.length + 2 > writer.remaining') <
      stringSource.indexOf('for (let index = 0; index < value.length'),
  );
  assert.ok(
    stringSource.indexOf('value.length + 2 > writer.remaining') <
      stringSource.indexOf('writer.appendAscii'),
  );

  const arrayStart = coordinator.indexOf('function canonicalizeArray(');
  const objectStart = coordinator.indexOf('\nfunction canonicalizeObject(', arrayStart);
  const arraySource = coordinator.slice(arrayStart, objectStart);
  assert.ok(arraySource.indexOf("getOwnPropertyDescriptor(value, 'length')") >= 0);
  assert.ok(arraySource.indexOf('length > MAX_JSON_ARRAY_ELEMENTS') >= 0);
  assert.ok(
    arraySource.indexOf('length > MAX_JSON_ARRAY_ELEMENTS') <
      arraySource.indexOf('Reflect.ownKeys(value)'),
  );
});

test('transporte preserva métodos existentes e acrescenta PATCH', () => {
  const transport = source('src/http/httpTransport.ts');
  assert.match(
    transport,
    /readonly method: 'GET' \| 'POST' \| 'PATCH' \| 'DELETE'/,
  );
  assert.doesNotMatch(transport, /console\.|logger\./);
});

test('contrato decimal não usa conversão IEEE-754 e reserva null ao PATCH', () => {
  const area = source('src/http/administrativeArea.ts');
  assert.doesNotMatch(area, /\bNumber\b|parseFloat|parseInt/);
  assert.match(area, /area_total\?: AdministrativeAreaTotal;/);
  assert.match(area, /area_total\?: AdministrativeAreaTotal \| null;/);
  assert.match(area, /return value as AdministrativeAreaTotal/);
});

test('runtime limpa partição administrativa por publicação de sessão e epoch', () => {
  const runtime = source('src/http/runtime.ts');
  assert.match(runtime, /new AdministrativeCommandCoordinator\(\{ session \}\)/);
  assert.match(runtime, /synchronizeSession\(session\.snapshot, session\.epoch\)/);
  assert.match(runtime, /session\.subscribe\(\(snapshot\)/);
  assert.match(runtime, /synchronizeSession\(snapshot, session\.epoch\)/);
});
