const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CADERNO_TALHAO_LEGADO_VALUE,
  buildCadernoPayload,
  buildCadernoTalhaoOptions,
  findCadernoTalhaoByRoute,
} = require('../.tmp-domain-compat/src/utils/cadernoFormCompat');
const {
  PERIODO_PRODUTIVO_TALHAO_LEGADO_VALUE,
  buildPeriodoProdutivoTalhaoOptions,
} = require('../.tmp-domain-compat/src/utils/periodoProdutivoFormCompat');
const { normalizeCadernoCampo } = require('../.tmp-domain-compat/src/domain/domainCompat');

const readSource = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const run = () => {
  const talhoes = [
    {
      id: 'geometria_norte_v1',
      talhao_id: 'talhao_norte',
      fazenda_id: 'faz_1',
      talhao: 'Talhão Norte',
    },
    { id: 'geometria_sem_id', talhao: 'Geometria sem identidade lógica' },
    { talhao: 'Texto sem ID' },
  ];
  const cadernoOptions = buildCadernoTalhaoOptions(talhoes);
  assert.equal(cadernoOptions.options[0].label, 'Toda a Propriedade');
  assert.deepEqual(cadernoOptions.options.slice(1), [
    { value: 'talhao_norte', label: 'Talhão Norte' },
  ]);
  assert.deepEqual(findCadernoTalhaoByRoute(talhoes, 'talhao_norte'), {
    id: 'talhao_norte',
    nome: 'Talhão Norte',
  });
  assert.deepEqual(findCadernoTalhaoByRoute(talhoes, 'geometria_norte_v1'), {
    id: 'talhao_norte',
    nome: 'Talhão Norte',
  });
  assert.equal(findCadernoTalhaoByRoute(talhoes, 'geometria_sem_id'), null);
  assert.equal(findCadernoTalhaoByRoute(talhoes, 'nome-forjado'), null);

  const legacyCaderno = buildCadernoTalhaoOptions([], { nome: 'Talhão antigo' });
  assert.equal(legacyCaderno.selectedValue, CADERNO_TALHAO_LEGADO_VALUE);
  assert.equal(legacyCaderno.legacy, true);

  const payload = buildCadernoPayload({
    fazendaId: 'faz_1',
    dataAtividade: new Date('2026-08-03T12:00:00.000Z'),
    tipoAtividade: 'observacao',
    talhaoId: 'talhao_norte',
    talhao: 'Talhão Norte no momento do registro',
    responsavelUsuarioId: 'usuario_1',
    colaboradorResponsavel: 'Ana Campo',
    criadoPorUserId: 'usuario_1',
    criadoPorNome: 'Ana Campo',
  });
  assert.equal(payload.talhao_id, 'talhao_norte');
  assert.equal(payload.talhao_nome, 'Talhão Norte no momento do registro');
  assert.equal(payload.responsavel_usuario_id, 'usuario_1');
  assert.equal(payload.colaborador_responsavel, 'Ana Campo');
  assert.equal(payload.criado_por_user_id, 'usuario_1');
  assert.equal(payload.criado_por_nome, 'Ana Campo');

  const normalized = normalizeCadernoCampo({
    id: 'c1',
    fazenda_id: 'faz_1',
    responsavel_usuario_id: 'usuario_1',
    colaborador_responsavel: 'Ana Campo',
    data_atividade: '2026-08-03T12:00:00.000Z',
    tipo_atividade: 'observacao',
    talhao_id: 'talhao_norte',
    talhao_nome: 'Snapshot Norte',
    criado_por_user_id: 'usuario_1',
    criado_por_nome: 'Ana Campo',
  });
  assert.equal(normalized.talhao_id, 'talhao_norte');
  assert.equal(normalized.talhao, 'Snapshot Norte');
  assert.equal(normalized.responsavel_usuario_id, 'usuario_1');
  assert.equal(normalized.criado_por_nome, 'Ana Campo');

  const legacyNormalized = normalizeCadernoCampo({
    id: 'legacy',
    produtor_id: 'faz_1',
    colaborador_responsavel: 'Nome antigo',
    data_atividade: '2026-01-01T00:00:00.000Z',
    tipo_atividade: 'vistoria',
    talhao: 'Talhão em texto',
  });
  assert.equal(legacyNormalized.responsavel_usuario_id, undefined);
  assert.equal(legacyNormalized.talhao_id, undefined);
  assert.equal(legacyNormalized.talhao_nome, 'Talhão em texto');

  const periodoLegacy = buildPeriodoProdutivoTalhaoOptions([], { nome: 'Talhão legado' });
  assert.equal(periodoLegacy.selectedValue, PERIODO_PRODUTIVO_TALHAO_LEGADO_VALUE);
  assert.match(periodoLegacy.options[1].description, /legada em texto/i);
  const periodoWithoutId = buildPeriodoProdutivoTalhaoOptions([{ talhao: 'Sem ID' }]);
  assert.equal(periodoWithoutId.options.length, 1);
  const periodoWithGeometryOnly = buildPeriodoProdutivoTalhaoOptions([
    { id: 'geometria_1', talhao: 'Sem identidade lógica' },
  ]);
  assert.equal(periodoWithGeometryOnly.options.length, 1);

  const novoCadernoSource = readSource('src/screens/NovoCadernoScreen.tsx');
  const editarCadernoSource = readSource('src/screens/EditarCadernoScreen.tsx');
  const mapasSource = readSource('src/screens/MapasScreen.tsx');
  assert.match(novoCadernoSource, /label="Responsável pelo registro"[\s\S]*?disabled/);
  assert.match(editarCadernoSource, /label="Responsável pelo registro"[\s\S]*?disabled/);
  assert.doesNotMatch(novoCadernoSource, /label="Talhão"[\s\S]{0,120}onChangeText/);
  assert.doesNotMatch(editarCadernoSource, /label="Talhão"[\s\S]{0,120}onChangeText/);
  assert.doesNotMatch(mapasSource, /label="Nome do Talhão"/);
  assert.doesNotMatch(mapasSource, /const id =[\s\S]{0,120}: nome;/);
  assert.match(mapasSource, /const id = getTalhaoStableId\(talhao\)/);

  console.log('MP-24: referências estáveis e compatibilidade legada validadas.');
};

run();
