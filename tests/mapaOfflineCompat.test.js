const assert = require('node:assert/strict');
const {
  buildScopedStorageKey,
  normalizeBackupMapaOffline,
  parseScopedStorageKey,
  toRequisicaoSincronizacaoCompativel,
} = require('../.tmp-domain-compat/src/services/mapaOfflineCompat');
const { MapaSincronizacaoService } = require('../.tmp-domain-compat/src/services/MapaSincronizacaoService');
const { Mapa } = require('../.tmp-domain-compat/src/api/mapaSyncEndpoints');
const { SELA_DEPRATA_1_PRODUTOR_ID } = require('../.tmp-domain-compat/src/assets/kml/selaDeprata1');

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
  await test('toRequisicaoSincronizacaoCompativel aceita alias legado e explicita fazenda_id', () => {
    const requisicao = toRequisicaoSincronizacaoCompativel({
      produtor_id: 'faz_001',
      data_ultima_sincronizacao: 123,
      versao_app: '1.0.0',
    });

    assert.equal(requisicao.fazenda_id, 'faz_001');
    assert.equal(requisicao.produtor_id, 'faz_001');
    assert.equal(requisicao.data_ultima_sincronizacao, 123);
  });

  await test('buildScopedStorageKey e parseScopedStorageKey usam fazenda_id como chave operacional', () => {
    const key = buildScopedStorageKey('@mapas_talhao_', 'faz_77', 'talhao9');
    const parsed = parseScopedStorageKey('@mapas_talhao_', key);

    assert.equal(key, '@mapas_talhao_faz_77_talhao9');
    assert.deepEqual(parsed, {
      fazenda_id: 'faz_77',
      item_id: 'talhao9',
    });
  });

  await test('normalizeBackupMapaOffline reconcilia backup legado de produtor para fazenda', () => {
    const backup = normalizeBackupMapaOffline({
      versao: '1.0',
      produtor_id: 'faz_backup',
      data_export: '2026-04-16T00:00:00.000Z',
      checksum: 'abc123',
      talhoes: [
        {
          id: 't1',
          talhao: 'Talhão 1',
          area_hectares: 12,
          poligono: [{ lat: -1, lng: -2 }],
        },
      ],
    });

    assert.equal(backup.fazenda_id, 'faz_backup');
    assert.equal(backup.talhoes[0].fazenda_id, 'faz_backup');
    assert.equal(backup.talhoes[0].produtor_id, 'faz_backup');
  });

  await test('MapaSincronizacaoService usa fazenda_id internamente e preserva wrapper legado', async () => {
    let capturedRequest = null;
    const service = new MapaSincronizacaoService(
      { intervalo_minimo_ms: 10 },
      {
        now: () => 1_000,
        deviceIdFactory: () => 'device_test',
        syncApi: async (req) => {
          capturedRequest = req;
          return {
            mapas_atualizados: [
              {
                id: 'talhao_sync',
                talhao: 'Talhão Sync',
                area_hectares: 18,
                poligono: [{ lat: -10, lng: -55 }],
              },
            ],
            mapas_removidos: [],
            proxima_sincronizacao_em: 10,
          };
        },
      }
    );

    const resultadoCanonico = await service.sincronizarFazendaMapas('faz_sync');
    const estadoCanonico = service.obterEstadoLocalFazenda('faz_sync', 'talhao_sync');
    const logsCanonicos = service.obterLogsFazenda('faz_sync');

    assert.equal(capturedRequest.fazenda_id, 'faz_sync');
    assert.equal(capturedRequest.produtor_id, 'faz_sync');
    assert.equal(resultadoCanonico.talhoes_atualizados[0].fazenda_id, 'faz_sync');
    assert.equal(resultadoCanonico.talhoes_atualizados[0].produtor_id, 'faz_sync');
    assert.equal(estadoCanonico.fazenda_id, 'faz_sync');
    assert.equal(estadoCanonico.produtor_id, 'faz_sync');
    assert.equal(logsCanonicos[0].fazenda_id, 'faz_sync');
    assert.equal(logsCanonicos[0].produtor_id, 'faz_sync');

    const serviceLegado = new MapaSincronizacaoService(
      { intervalo_minimo_ms: 10 },
      {
        now: () => 2_000,
        deviceIdFactory: () => 'device_test_legacy',
        syncApi: async () => ({
          mapas_atualizados: [
            {
              id: 'talhao_legacy',
              talhao: 'Talhão Legacy',
              area_hectares: 9,
              poligono: [{ lat: -11, lng: -54 }],
            },
          ],
          mapas_removidos: [],
          proxima_sincronizacao_em: 10,
        }),
      }
    );

    await serviceLegado.sincronizarProdutorMapas('faz_legacy');
    const estadoLegado = serviceLegado.obterEstadoLocal('faz_legacy', 'talhao_legacy');
    assert.equal(estadoLegado.fazenda_id, 'faz_legacy');
    assert.equal(estadoLegado.produtor_id, 'faz_legacy');
  });

  await test('API de sincronização mockada aceita fazenda_id e mantém alias legado na resposta', async () => {
    const respostaSync = await Mapa.sincronizar({
      fazenda_id: SELA_DEPRATA_1_PRODUTOR_ID,
      data_ultima_sincronizacao: 0,
      versao_app: '1.0.0',
    });

    const respostaMapas = await Mapa.obterPorFazenda(SELA_DEPRATA_1_PRODUTOR_ID);

    assert.ok(respostaSync.mapas_atualizados.length > 0);
    assert.equal(respostaSync.mapas_atualizados[0].fazenda_id, SELA_DEPRATA_1_PRODUTOR_ID);
    assert.equal(respostaSync.mapas_atualizados[0].produtor_id, SELA_DEPRATA_1_PRODUTOR_ID);
    assert.equal(respostaMapas.fazenda_id, SELA_DEPRATA_1_PRODUTOR_ID);
    assert.equal(respostaMapas.produtor_id, SELA_DEPRATA_1_PRODUTOR_ID);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de mapaOfflineCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
