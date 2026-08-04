const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildRegistroFotoDownloadName,
  getRegistroFotoUri,
  isRegistroFotoUriBaixavel,
  podeBaixarFotoRegistro,
} = require('../.tmp-domain-compat/src/utils/registroFotoCompat');

let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

const run = async () => {
  const modal = read('src/components/RegistroFotoViewerModal.tsx');
  const visitaDetail = read('src/screens/VisitaDetailScreen.tsx');
  const cadernoDetail = read('src/screens/CadernoDetailScreen.tsx');

  await test('foto legada string ou objeto permanece legivel', () => {
    assert.equal(getRegistroFotoUri(' https://example.test/foto.jpg '), 'https://example.test/foto.jpg');
    assert.equal(getRegistroFotoUri({ uri: 'file:///registro/foto.png' }), 'file:///registro/foto.png');
    assert.equal(getRegistroFotoUri({ url: 'https://example.test/nao-suportada.jpg' }), null);
    assert.equal(getRegistroFotoUri(''), null);
  });

  await test('download exige URI realmente acionavel', () => {
    assert.equal(isRegistroFotoUriBaixavel('https://example.test/foto.jpg'), true);
    assert.equal(isRegistroFotoUriBaixavel('file:///registro/foto.jpg'), true);
    assert.equal(isRegistroFotoUriBaixavel('content://registro/foto.jpg'), true);
    assert.equal(isRegistroFotoUriBaixavel('foto-legada.jpg'), false);
    assert.equal(isRegistroFotoUriBaixavel('asset://foto.jpg'), false);
  });

  await test('acao revalida acesso ao registro e disponibilidade da foto', () => {
    const admin = { id: 'admin', perfil: 'admin' };
    const produtor = { id: 'produtor', perfil: 'produtor', produtor_id: 'titular-1' };
    const outroProdutor = { id: 'outro', perfil: 'produtor', produtor_id: 'titular-2' };
    const fazenda = { id: 'faz-1', fazenda_id: 'faz-1', produtor_id: 'titular-1' };
    const visita = { id: 'vis-1', fazenda_id: 'faz-1', fotos: [] };
    const caderno = {
      id: 'cad-1',
      fazenda_id: 'faz-1',
      estado_registro: 'registrado',
      visivel_para_produtor: true,
      fotos: [],
    };
    const foto = 'https://example.test/foto.jpg';

    assert.equal(podeBaixarFotoRegistro({ user: admin, registro: visita, fazenda, origem: 'visita', foto }), true);
    assert.equal(podeBaixarFotoRegistro({ user: produtor, registro: visita, fazenda, origem: 'visita', foto }), true);
    assert.equal(podeBaixarFotoRegistro({ user: outroProdutor, registro: visita, fazenda, origem: 'visita', foto }), false);
    assert.equal(podeBaixarFotoRegistro({ user: produtor, registro: caderno, fazenda, origem: 'caderno', foto }), true);
    assert.equal(podeBaixarFotoRegistro({ user: produtor, registro: caderno, fazenda, origem: 'caderno', foto: 'sem-esquema.jpg' }), false);
  });

  await test('nome local e deterministico e preserva extensao suportada', () => {
    assert.equal(buildRegistroFotoDownloadName('https://example.test/foto.webp?token=1', 'visita', 1), 'foto-visita-2.webp');
    assert.equal(buildRegistroFotoDownloadName('https://picsum.photos/400/300?random=1', 'caderno', 0), 'foto-caderno-1.jpg');
  });

  await test('Caderno e Visita abrem a mesma experiencia de ampliacao', () => {
    assert.match(visitaDetail, /<RegistroFotoViewerModal/);
    assert.match(cadernoDetail, /<RegistroFotoViewerModal/);
    assert.match(visitaDetail, /Ampliar imagem \$\{index \+ 1\}/);
    assert.match(cadernoDetail, /Ampliar foto \$\{index \+ 1\}/);
    assert.match(modal, /presentationStyle="fullScreen"/);
    assert.match(modal, /Gesture\.Pinch\(\)/);
    assert.match(modal, /Gesture\.Pan\(\)/);
    assert.match(modal, /numberOfTaps\(2\)/);
    assert.match(modal, /Ampliar foto/);
    assert.match(modal, /O arraste fica contido na imagem/);
  });

  await test('download autorizado confirma somente depois do arquivo existir', () => {
    assert.match(modal, /downloadAuthorized/);
    assert.match(modal, /FileSystem\.downloadAsync/);
    assert.match(modal, /FileSystem\.copyAsync/);
    assert.match(modal, /FileSystem\.getInfoAsync/);
    assert.match(modal, /if \(!info\.exists\) throw/);
    assert.match(modal, /Foto baixada para o armazenamento local do aplicativo/);
    assert.match(modal, /Não foi possível baixar esta foto/);
    assert.doesNotMatch(modal, /launchCamera|launchImageLibrary|ImagePicker|CameraView/);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de registroFotoCompat passaram.');
  }
};

run().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
