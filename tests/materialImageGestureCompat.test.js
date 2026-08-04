const assert = require('node:assert/strict');

const {
  MATERIAL_IMAGE_DOUBLE_TAP_ZOOM,
  clampMaterialImageOffset,
  clampMaterialImageZoom,
  resolveMaterialImageZoomAroundPoint,
} = require('../.tmp-domain-compat/src/utils/materialImageGestureCompat');

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

const run = async () => {
  await test('zoom por pinca e botoes permanece entre 100% e 400%', () => {
    assert.equal(clampMaterialImageZoom(0.2), 1);
    assert.equal(clampMaterialImageZoom(2.35), 2.35);
    assert.equal(clampMaterialImageZoom(9), 4);
    assert.equal(MATERIAL_IMAGE_DOUBLE_TAP_ZOOM, 2);
  });

  await test('imagem em 100% permanece centralizada e libera arraste externo', () => {
    assert.deepEqual(
      clampMaterialImageOffset({ x: 80, y: -45 }, 1, { width: 300, height: 400 }),
      { x: 0, y: 0 }
    );
  });

  await test('arraste ampliado fica limitado pelas bordas do viewport', () => {
    assert.deepEqual(
      clampMaterialImageOffset({ x: 800, y: -900 }, 2, { width: 300, height: 400 }),
      { x: 150, y: -200 }
    );
  });

  await test('pinca preserva o ponto focal sem deixar a imagem escapar', () => {
    assert.deepEqual(
      resolveMaterialImageZoomAroundPoint({
        startZoom: 1,
        nextZoom: 2,
        startOffset: { x: 0, y: 0 },
        point: { x: 250, y: 100 },
        viewport: { width: 300, height: 400 },
      }),
      { x: -100, y: 100 }
    );
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de materialImageGestureCompat passaram.');
  }
};

run().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
