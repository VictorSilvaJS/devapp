const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildPeriodoProdutivoTalhaoOptions,
  maskPeriodoProdutivoAnoAgricola,
  isPeriodoProdutivoAnoAgricolaValido,
  resolvePeriodoProdutivoCulturaSelection,
  resolvePeriodoProdutivoCulturaValue,
  validatePeriodoProdutivoFormValues,
} = require('../.tmp-domain-compat/src/utils/periodoProdutivoFormCompat');

const readSource = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const run = () => {
  assert.equal(maskPeriodoProdutivoAnoAgricola('20252026'), '2025/2026');
  assert.equal(maskPeriodoProdutivoAnoAgricola('2025/2026abc'), '2025/2026');
  assert.equal(maskPeriodoProdutivoAnoAgricola('20252'), '2025/2');
  assert.equal(isPeriodoProdutivoAnoAgricolaValido('2025/2026'), true);
  assert.equal(isPeriodoProdutivoAnoAgricolaValido('25/26'), false);
  assert.equal(isPeriodoProdutivoAnoAgricolaValido('2025-2026'), false);

  assert.deepEqual(resolvePeriodoProdutivoCulturaSelection('Algodão'), {
    option: 'algodao',
    outro: '',
  });
  assert.deepEqual(resolvePeriodoProdutivoCulturaSelection('Feijão'), {
    option: 'outro',
    outro: 'Feijão',
  });
  assert.equal(resolvePeriodoProdutivoCulturaValue('soja', ''), 'Soja');
  assert.equal(resolvePeriodoProdutivoCulturaValue('outro', ' Feijão '), 'Feijão');

  const talhaoOptions = buildPeriodoProdutivoTalhaoOptions([
    { id: 'limite_1', talhao_id: 'talhao_norte', talhao: 'Área Norte' },
    { id: 'limite_2', talhao_id: 'talhao_norte', talhao: ' area  norte ' },
    { id: 'limite_3', talhao_id: 'talhao_sul', talhao: 'Área Sul' },
    { id: 'limite_sem_identidade', talhao: 'Sem identidade lógica' },
  ], { id: 'talhao_norte', nome: 'Área Norte' });
  assert.deepEqual(talhaoOptions, {
    options: [
      { value: '', label: 'Toda a Propriedade' },
      { value: 'talhao_norte', label: 'Área Norte' },
      { value: 'talhao_sul', label: 'Área Sul' },
    ],
    selectedValue: 'talhao_norte',
  });

  const invalid = validatePeriodoProdutivoFormValues({
    tipoPeriodo: '',
    culturaOption: '',
    anoAgricola: '2026',
    dataInicio: new Date('2026-10-01T00:00:00.000Z'),
    dataFim: new Date('2026-09-01T00:00:00.000Z'),
    status: '',
  });
  assert.deepEqual(invalid, {
    tipoPeriodo: 'Selecione o tipo',
    cultura: 'Selecione a cultura',
    anoAgricola: 'Use o formato AAAA/AAAA',
    dataFim: 'A data final deve ser igual ou posterior ao início',
    status: 'Selecione o status',
  });
  assert.deepEqual(validatePeriodoProdutivoFormValues({
    tipoPeriodo: 'safra',
    culturaOption: 'outro',
    culturaOutro: 'Feijão',
    anoAgricola: '2026/2027',
    dataInicio: new Date('2026-09-01T00:00:00.000Z'),
    dataFim: new Date('2026-09-01T00:00:00.000Z'),
    status: 'planejada',
  }), {});

  const formSource = readSource('src/screens/PeriodoProdutivoFormScreen.tsx');
  const mapaSource = readSource('src/screens/MapasScreen.tsx');
  const talhaoModalSource = readSource('src/components/TalhaoDetailModal.tsx');
  const propriedadeSource = readSource('src/screens/ProdutorScreen.tsx');

  assert.match(formSource, /useState<PeriodoProdutivoTipo \| ''>\(''\)/);
  assert.match(formSource, /useState<PeriodoProdutivoStatus \| ''>\(''\)/);
  assert.match(formSource, /label="Cultura"[\s\S]*PERIODO_PRODUTIVO_CULTURA_OPTIONS/);
  assert.match(formSource, /label="Talhão"[\s\S]*options=\{talhaoOptions\.options\}/);
  assert.doesNotMatch(formSource, /label="Talhão"[\s\S]{0,120}onChangeText=/);
  assert.doesNotMatch(mapaSource, /handleNovoPeriodoTalhao|onCreatePeriodo=/);
  assert.doesNotMatch(talhaoModalSource, /Nova Safra\/Safrinha|onCreatePeriodo/);
  assert.match(propriedadeSource, /title="Safras e Safrinha"[\s\S]*actionLabel=\{podeGerenciarPeriodosNaFazenda \? 'Novo'/);

  console.log('Todos os testes de periodoProdutivoFormCompat passaram.');
};

run();
