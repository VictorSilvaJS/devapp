const assert = require('node:assert/strict');
const {
  avaliarDownloadMapa,
  buildMapaArquivoAssociacaoPayload,
  inferFormatoArquivoFromUrl,
  isMapaArquivoUrlUsavel,
  resolveMapaArquivoUrl,
} = require('../.tmp-domain-compat/src/utils/mapaDownloadCompat');

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
  await test('isMapaArquivoUrlUsavel aceita apenas URLs abríveis pelo app', () => {
    assert.equal(isMapaArquivoUrlUsavel('https://cdn.exemplo.com/mapa.pdf'), true);
    assert.equal(isMapaArquivoUrlUsavel('file:///tmp/mapa.pdf'), true);
    assert.equal(isMapaArquivoUrlUsavel('content://downloads/mapa.pdf'), true);
    assert.equal(isMapaArquivoUrlUsavel('data:application/pdf;base64,abc'), true);
    assert.equal(isMapaArquivoUrlUsavel('mapas/fertilidade_p1.pdf'), false);
    assert.equal(isMapaArquivoUrlUsavel(''), false);
  });

  await test('resolveMapaArquivoUrl prioriza arquivo principal e aceita aliases controlados', () => {
    assert.equal(
      resolveMapaArquivoUrl({
        arquivo_url: 'https://cdn.exemplo.com/principal.pdf',
        arquivo_panorama_url: 'https://cdn.exemplo.com/panorama.jpg',
      }),
      'https://cdn.exemplo.com/principal.pdf'
    );

    assert.equal(
      resolveMapaArquivoUrl({
        url_download: 'https://cdn.exemplo.com/legado.pdf',
      }),
      'https://cdn.exemplo.com/legado.pdf'
    );
  });

  await test('inferFormatoArquivoFromUrl deriva extensão de URLs abríveis', () => {
    assert.equal(inferFormatoArquivoFromUrl('https://cdn.exemplo.com/mapa.PDF?token=1'), 'pdf');
    assert.equal(inferFormatoArquivoFromUrl('file:///tmp/panorama.jpeg'), 'jpg');
    assert.equal(inferFormatoArquivoFromUrl('data:application/pdf;base64,abc'), 'pdf');
  });

  await test('buildMapaArquivoAssociacaoPayload monta update compatível para URL real', () => {
    const result = buildMapaArquivoAssociacaoPayload({
      arquivoUrl: 'https://cdn.exemplo.com/mapa.pdf',
      tamanhoArquivo: '12345',
    });

    assert.deepEqual(result, {
      ok: true,
      payload: {
        arquivo_url: 'https://cdn.exemplo.com/mapa.pdf',
        formato_arquivo: 'pdf',
        tamanho_arquivo: 12345,
        disponivel_download: true,
        disponivel_para_download: true,
      },
    });
  });

  await test('buildMapaArquivoAssociacaoPayload rejeita caminho relativo e tamanho inválido', () => {
    assert.deepEqual(buildMapaArquivoAssociacaoPayload({ arquivoUrl: 'mapas/local.pdf' }), {
      ok: false,
      mensagem: 'Informe uma URL abrível, como https://, file://, content:// ou data:.',
    });

    assert.deepEqual(
      buildMapaArquivoAssociacaoPayload({
        arquivoUrl: 'https://cdn.exemplo.com/mapa.pdf',
        tamanhoArquivo: 'abc',
      }),
      {
        ok: false,
        mensagem: 'Informe o tamanho em bytes com um número maior que zero ou deixe em branco.',
      }
    );
  });

  await test('avaliarDownloadMapa libera abertura somente com flag e URL real', () => {
    const status = avaliarDownloadMapa({
      disponivel_download: true,
      arquivo_url: 'https://cdn.exemplo.com/mapa.pdf',
    });

    assert.deepEqual(status, {
      podeAbrir: true,
      arquivoUrl: 'https://cdn.exemplo.com/mapa.pdf',
      motivo: 'disponivel',
      label: 'Abrir material',
      descricao: 'Material com URL abrível disponível.',
    });
  });

  await test('avaliarDownloadMapa bloqueia material não liberado mesmo com URL real', () => {
    const status = avaliarDownloadMapa({
      disponivel_download: false,
      arquivo_url: 'https://cdn.exemplo.com/mapa.pdf',
    });

    assert.equal(status.podeAbrir, false);
    assert.equal(status.motivo, 'nao_liberado');
  });

  await test('avaliarDownloadMapa identifica caminho relativo do mock como pendente', () => {
    const status = avaliarDownloadMapa({
      disponivel_download: true,
      arquivo_url: 'mapas/fertilidade_p1_talhaoa.pdf',
    });

    assert.equal(status.podeAbrir, false);
    assert.equal(status.arquivoUrl, 'mapas/fertilidade_p1_talhaoa.pdf');
    assert.equal(status.motivo, 'arquivo_nao_usavel');
  });

  await test('avaliarDownloadMapa diferencia registro sem arquivo anexado', () => {
    const status = avaliarDownloadMapa({
      disponivel_download: true,
    });

    assert.equal(status.podeAbrir, false);
    assert.equal(status.motivo, 'sem_arquivo');
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de mapaDownloadCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
