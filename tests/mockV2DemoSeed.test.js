const assert = require('node:assert/strict');
const {
  MOCK_V2_DEMO_DATASET_ID,
  MOCK_V2_DEMO_SEED,
} = require('../.tmp-domain-compat/src/api/mockV2DemoSeed');
const {
  MOCK_V2_TALHAO_GEOMETRY_COUNT,
  buildMockV2LimitesArea,
} = require('../.tmp-domain-compat/src/api/mockV2TalhaoGeometry');
const {
  MOCK_V2_DEMO_CREDENTIALS,
} = require('../.tmp-domain-compat/src/auth/mockV2DemoCredentials');
const { validateMockV2State } = require('../.tmp-domain-compat/src/api/mockV2Validation');

const COLLABORATOR_IDS = [
  'usr_colaborador_victor',
  'usr_colaborador_bruna_brito',
];

const testMockV2DemoSeed = async () => {
  const seed = MOCK_V2_DEMO_SEED;

  assert.equal(validateMockV2State(seed), true);
  assert.equal(seed.dataset.id, MOCK_V2_DEMO_DATASET_ID);
  assert.equal(seed.dataset.tipo, 'demonstracao');
  assert.match(seed.dataset.fonte_sha256, /^[a-f0-9]{64}$/);

  assert.equal(seed.usuarios.length, 40);
  assert.equal(seed.usuarios.filter((user) => user.perfil === 'admin').length, 2);
  assert.equal(seed.usuarios.filter((user) => user.perfil === 'colaborador').length, 2);
  assert.equal(seed.usuarios.filter((user) => user.perfil === 'produtor').length, 36);
  assert.deepEqual(
    seed.usuarios.filter((user) => user.perfil === 'admin').map((user) => user.id).sort(),
    ['usr_admin_bruna', 'usr_admin_cesar']
  );
  assert.deepEqual(
    seed.usuarios.filter((user) => user.perfil === 'colaborador').map((user) => user.id).sort(),
    [...COLLABORATOR_IDS].sort()
  );

  assert.equal(seed.produtores.length, 36);
  assert.equal(seed.propriedades.length, 70);
  assert.equal(seed.usuarios_propriedades.length, 140);
  assert.equal(seed.talhoes.length, 470);
  assert.equal(seed.visitas.length, 70);
  assert.equal(seed.cadernos.length, 70);
  assert.equal(seed.materiais.length, 70);

  const usersById = new Map(seed.usuarios.map((user) => [user.id, user]));
  const producersById = new Map(seed.produtores.map((producer) => [producer.id, producer]));
  const propertiesById = new Map(seed.propriedades.map((property) => [property.id, property]));
  const titularUserByProperty = new Map();

  for (const property of seed.propriedades) {
    const producer = producersById.get(property.titular_id);
    assert.ok(producer, `Produtor titular ausente em ${property.id}`);
    assert.equal(usersById.get(producer.usuario_id)?.perfil, 'produtor');
    titularUserByProperty.set(property.id, producer.usuario_id);

    const links = seed.usuarios_propriedades.filter((link) => link.propriedade_id === property.id);
    assert.equal(links.length, 2, `Quantidade de vínculos em ${property.id}`);
    assert.equal(links.filter((link) => link.tipo_vinculo === 'titular').length, 1);
    assert.equal(links.filter((link) => link.tipo_vinculo === 'colaborador').length, 1);
  }

  const collaboratorProperties = new Map(COLLABORATOR_IDS.map((id) => [id, new Set()]));
  const collaboratorProducers = new Map(COLLABORATOR_IDS.map((id) => [id, new Set()]));
  for (const link of seed.usuarios_propriedades.filter((item) => item.tipo_vinculo === 'colaborador')) {
    collaboratorProperties.get(link.usuario_id).add(link.propriedade_id);
    collaboratorProducers.get(link.usuario_id).add(titularUserByProperty.get(link.propriedade_id));
  }

  for (const collaboratorId of COLLABORATOR_IDS) {
    assert.equal(collaboratorProperties.get(collaboratorId).size, 35);
    assert.equal(collaboratorProducers.get(collaboratorId).size, 18);
  }
  const [victorProperties, brunaProperties] = COLLABORATOR_IDS.map(
    (id) => collaboratorProperties.get(id)
  );
  assert.equal([...victorProperties].some((id) => brunaProperties.has(id)), false);
  assert.equal(new Set([...victorProperties, ...brunaProperties]).size, propertiesById.size);

  const serializedSeed = JSON.stringify(seed);
  for (const forbiddenKey of [
    'fazenda_id', 'fazendaId', 'produtor_id', 'proprietario_id',
    'regiao', 'microregiao', 'senha', 'password',
  ]) {
    assert.equal(serializedSeed.includes(`"${forbiddenKey}"`), false, forbiddenKey);
  }
  assert.equal(seed.propriedades.every((property) => property.uf_sigla === 'MT'), true);
  assert.equal(seed.propriedades.every((property) => property.area_total === undefined), true);
  assert.equal(seed.propriedades.every((property) => property.cultura_principal === undefined), true);

  const credentials = MOCK_V2_DEMO_CREDENTIALS;
  assert.equal(credentials.dataset_id, MOCK_V2_DEMO_DATASET_ID);
  assert.equal(credentials.credentials.length, seed.usuarios.length);
  assert.equal(new Set(credentials.credentials.map((item) => item.email.toLowerCase())).size, 40);
  for (const credential of credentials.credentials) {
    const user = usersById.get(credential.usuario_id);
    assert.ok(user, `Usuário da credencial ausente: ${credential.usuario_id}`);
    assert.equal(user.email, credential.email);
    assert.equal(credential.email.endsWith('@example.com'), true);
    assert.ok(credential.senha.length >= 7);
  }

  const limites = buildMockV2LimitesArea(seed);
  assert.equal(MOCK_V2_TALHAO_GEOMETRY_COUNT, 470);
  assert.equal(limites.length, seed.talhoes.length);
  assert.equal(new Set(limites.map((limite) => limite.talhao_id)).size, seed.talhoes.length);
  for (const limite of limites) {
    assert.ok(propertiesById.has(limite.propriedade_id));
    assert.ok(seed.talhoes.some((talhao) =>
      talhao.id === limite.talhao_id && talhao.propriedade_id === limite.propriedade_id
    ));
    assert.ok(limite.area_hectares > 0);
    assert.ok(limite.poligonos.length >= 1);
    assert.ok(limite.poligonos.every((polygon) => polygon.length >= 4));
    assert.ok(limite.poligonos.flat().every((point) =>
      point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180
    ));
  }

  console.log('Dataset demonstrativo mock v2 validado.');
};

module.exports = { testMockV2DemoSeed };

