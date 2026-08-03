const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getVisitaStatusPresentation,
  groupVisitasForList,
  isVisitaAtrasada,
} = require('../.tmp-domain-compat/src/utils/visitaListCompat');

let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
};

const referenceDate = new Date('2026-07-30T12:00:00.000Z');

test('separa próximas, pendentes e histórico sem alterar o estado persistido', () => {
  const visitas = [
    { id: 'hist-antiga', status: 'realizada', data_visita: '2026-07-10T10:00:00.000Z' },
    { id: 'proxima-2', status: 'agendada', data_visita: '2026-08-08T10:00:00.000Z' },
    { id: 'pendente-antiga', status: 'agendada', data_visita: '2026-05-28T10:00:00.000Z' },
    { id: 'hist-recente', status: 'cancelada', data_visita: '2026-07-20T10:00:00.000Z' },
    { id: 'proxima-1', status: 'agendada', data_visita: '2026-08-02T10:00:00.000Z' },
    { id: 'pendente-recente', status: 'agendada', data_visita: '2026-06-12T10:00:00.000Z' },
  ];

  const sections = groupVisitasForList(visitas, referenceDate);

  assert.deepEqual(sections.map((section) => section.id), ['proximas', 'pendentes', 'historico']);
  assert.deepEqual(sections[0].items.map((item) => item.id), ['proxima-1', 'proxima-2']);
  assert.deepEqual(sections[1].items.map((item) => item.id), ['pendente-recente', 'pendente-antiga']);
  assert.deepEqual(sections[2].items.map((item) => item.id), ['hist-recente', 'hist-antiga']);
  assert.equal(visitas[2].status, 'agendada');
});

test('atraso é indicador derivado somente para agendada vencida', () => {
  const atrasada = { status: 'agendada', data_visita: '2026-07-29T10:00:00.000Z' };
  const futura = { status: 'agendada', data_visita: '2026-07-31T10:00:00.000Z' };
  const realizada = { status: 'realizada', data_visita: '2026-07-29T10:00:00.000Z' };

  assert.equal(isVisitaAtrasada(atrasada, referenceDate), true);
  assert.equal(isVisitaAtrasada(futura, referenceDate), false);
  assert.equal(isVisitaAtrasada(realizada, referenceDate), false);
  assert.equal(getVisitaStatusPresentation(atrasada, referenceDate).label, 'Agendada · Atrasada');
  assert.equal(
    getVisitaStatusPresentation({ ...atrasada, status: 'AGENDADA' }, referenceDate).label,
    'Agendada · Atrasada'
  );
});

test('estados conhecidos e desconhecidos recebem rótulos públicos controlados', () => {
  assert.equal(getVisitaStatusPresentation({ status: 'realizada' }, referenceDate).label, 'Realizada');
  assert.equal(getVisitaStatusPresentation({ status: 'cancelada' }, referenceDate).label, 'Cancelada');
  assert.equal(getVisitaStatusPresentation({ status: 'anulada' }, referenceDate).label, 'Anulada');
  assert.equal(getVisitaStatusPresentation({ status: 'estado_interno' }, referenceDate).label, 'Status não reconhecido');
  assert.equal(getVisitaStatusPresentation({}, referenceDate).label, 'Status não informado');
});

test('telas usam apresentação comum e removem enum cru e marcador numérico', () => {
  const root = path.join(__dirname, '..');
  const globalList = fs.readFileSync(path.join(root, 'src/screens/VisitasScreen.tsx'), 'utf8');
  const propertyList = fs.readFileSync(path.join(root, 'src/screens/ProdutorScreen.tsx'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'src/screens/VisitaDetailScreen.tsx'), 'utf8');

  assert.match(globalList, /groupVisitasForList/);
  assert.match(globalList, /getVisitaStatusPresentation/);
  assert.match(propertyList, /groupVisitasForList/);
  assert.match(propertyList, /<OperationalCard/);
  assert.doesNotMatch(propertyList, /visitNumber|#\{visitas\.length/);
  assert.match(detail, /getVisitaStatusPresentation/);
  assert.doesNotMatch(detail, /const getStatusLabel/);
});

test('helper de lista não implementa mutações ou comandos de ciclo de vida', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src/utils/visitaListCompat.ts'),
    'utf8'
  );

  assert.doesNotMatch(source, /Visita\.(update|delete|create)/);
  assert.doesNotMatch(source, /concluir_visita|cancelar_visita|versao_base/);
});

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} teste(s) falharam.`);
} else {
  console.log('\nTodos os testes de visitaListCompat passaram.');
}
