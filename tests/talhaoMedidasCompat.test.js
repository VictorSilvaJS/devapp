const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MEDIDA_NAO_INFORMADA,
  formatAreaHa,
  formatPerimeter,
  normalizeAreaValue,
  normalizePerimeterValue,
  resolveAreaTotalInformada,
  summarizeMappedArea,
} = require('../.tmp-domain-compat/src/utils/talhaoMedidasCompat');

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

test('mantem area total 6200 separada da soma mapeada 1888,6', () => {
  const areasSela = [274.1, 192.8, 103.6, 66.4, 57, 218.3, 298.9, 127.5, 89.4, 82.7, 123, 62.7, 95.8, 52.7, 43.7];
  const areaTotal = resolveAreaTotalInformada({ area_total: 6200 });
  const mapeada = summarizeMappedArea(areasSela.map((area_hectares) => ({ area_hectares })));

  assert.equal(areaTotal, 6200);
  assert.equal(mapeada.totalTalhoes, 15);
  assert.ok(Math.abs(mapeada.areaMapeada - 1888.6) < 1e-9);
  assert.equal(formatAreaHa(areaTotal), '6.200 ha');
  assert.equal(mapeada.valorFormatado, '1.888,6 ha');
});

test('undefined retorna nao informado', () => {
  assert.equal(normalizeAreaValue(undefined), null);
  assert.equal(formatAreaHa(undefined), MEDIDA_NAO_INFORMADA);
});

test('null retorna nao informado', () => {
  assert.equal(normalizeAreaValue(null), null);
  assert.equal(formatAreaHa(null), MEDIDA_NAO_INFORMADA);
});

test('string vazia retorna nao informado', () => {
  assert.equal(normalizeAreaValue(''), null);
  assert.equal(formatAreaHa(''), MEDIDA_NAO_INFORMADA);
});

test('string numerica nao e convertida porque o contrato atual usa number', () => {
  assert.equal(normalizeAreaValue('1888.6'), null);
});

test('zero retorna nao informado', () => {
  assert.equal(normalizeAreaValue(0), null);
  assert.equal(formatAreaHa(0), MEDIDA_NAO_INFORMADA);
});

test('numero negativo retorna nao informado', () => {
  assert.equal(normalizeAreaValue(-1), null);
});

test('NaN retorna nao informado', () => {
  assert.equal(normalizeAreaValue(Number.NaN), null);
});

test('Infinity retorna nao informado', () => {
  assert.equal(normalizeAreaValue(Number.POSITIVE_INFINITY), null);
});

test('um Talhao com area valida retorna cobertura completa', () => {
  const result = summarizeMappedArea([{ area_hectares: 12.5 }]);
  assert.equal(result.coberturaAreas, 'completa');
  assert.equal(result.areaMapeada, 12.5);
});

test('todos os Talhoes com area valida usam label Area mapeada', () => {
  const result = summarizeMappedArea([{ area_hectares: 10 }, { area_hectares: 20 }]);
  assert.equal(result.label, 'Área mapeada');
  assert.equal(result.talhoesComArea, 2);
  assert.equal(result.areaMapeada, 30);
});

test('parte dos Talhoes sem area usa Area mapeada parcial', () => {
  const result = summarizeMappedArea([{ area_hectares: 10 }, { area_hectares: null }]);
  assert.equal(result.coberturaAreas, 'parcial');
  assert.equal(result.label, 'Área mapeada parcial');
  assert.equal(result.valorFormatado, '10 ha');
});

test('nenhum Talhao com area retorna nao informado', () => {
  const result = summarizeMappedArea([{ area_hectares: 0 }, {}]);
  assert.equal(result.coberturaAreas, 'ausente');
  assert.equal(result.areaMapeada, null);
  assert.equal(result.label, 'Área mapeada');
  assert.equal(result.valorFormatado, MEDIDA_NAO_INFORMADA);
});

test('lista vazia retorna cobertura ausente', () => {
  const result = summarizeMappedArea([]);
  assert.equal(result.totalTalhoes, 0);
  assert.equal(result.talhoesComArea, 0);
  assert.equal(result.coberturaAreas, 'ausente');
});

test('soma ignora valores invalidos', () => {
  const result = summarizeMappedArea([
    { area_hectares: 10 },
    { area_hectares: 0 },
    { area_hectares: -5 },
    { area_hectares: Number.NaN },
  ]);
  assert.equal(result.areaMapeada, 10);
  assert.equal(result.coberturaAreas, 'parcial');
});

test('formatacao de ausencia nao produz zero nem ha total', () => {
  const formatted = formatAreaHa(undefined);
  assert.equal(formatted, 'Não informado');
  assert.equal(formatted.includes('0 ha'), false);
  assert.equal(formatted.includes('ha total'), false);
});

test('perimetro ausente retorna nao informado', () => {
  assert.equal(normalizePerimeterValue(undefined), null);
  assert.equal(formatPerimeter(undefined, 'km', 'camada processada'), MEDIDA_NAO_INFORMADA);
});

test('perimetro invalido retorna nao informado', () => {
  assert.equal(normalizePerimeterValue(-2), null);
  assert.equal(formatPerimeter(-2, 'km', 'camada processada'), MEDIDA_NAO_INFORMADA);
});

test('perimetro exige unidade conhecida', () => {
  assert.equal(formatPerimeter(12.5, 'milhas', 'camada processada'), MEDIDA_NAO_INFORMADA);
  assert.equal(formatPerimeter(12.5, undefined, 'camada processada'), MEDIDA_NAO_INFORMADA);
});

test('perimetro exige origem comprovada', () => {
  assert.equal(formatPerimeter(12.5, 'km', undefined), MEDIDA_NAO_INFORMADA);
  assert.equal(formatPerimeter(12.5, 'km', ''), MEDIDA_NAO_INFORMADA);
  assert.equal(formatPerimeter(12.5, 'km', 'camada processada'), '12,5 km');
});

test('helper nao usa geometria nem calcula a partir de coordinates ou GeoJSON', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'utils', 'talhaoMedidasCompat.ts'),
    'utf8'
  );
  const result = summarizeMappedArea([{
    area_hectares: 7,
    coordinates: 'conteudo ignorado',
    poligono: 'conteudo ignorado',
  }]);

  assert.equal(result.areaMapeada, 7);
  assert.equal(/FeatureCollection|AsyncStorage|filesystem|coordinates|poligono|GeoJSON/i.test(source), false);
});

test('resumo nao afirma cobertura total da Propriedade', () => {
  const result = summarizeMappedArea([{ area_hectares: 100 }]);
  assert.equal(Object.hasOwn(result, 'areaTotal'), false);
  assert.equal(JSON.stringify(result).includes('Propriedade inteira'), false);
  assert.equal(result.label, 'Área mapeada');
});

test('area cadastral nao e sobrescrita pela area mapeada', () => {
  const propriedade = { area_total: 6200 };
  const result = summarizeMappedArea([{ area_hectares: 1888.6 }]);
  assert.equal(resolveAreaTotalInformada(propriedade), 6200);
  assert.equal(result.areaMapeada, 1888.6);
  assert.equal(propriedade.area_total, 6200);
});

if (failed > 0) {
  process.exit(1);
}

console.log('\nTodos os testes de talhaoMedidasCompat passaram.');
