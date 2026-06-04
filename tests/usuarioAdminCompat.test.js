const assert = require('node:assert/strict');
const {
  buildUsuarioAdminPayload,
  buildVinculosPropriedadesPorMicroregioes,
} = require('../.tmp-domain-compat/src/utils/usuarioAdminCompat');

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

const propriedades = [
  {
    id: 'prop_sul_1',
    fazenda_id: 'prop_sul_1',
    fazenda_nome: 'Propriedade Sul Um',
    produtor_id: 'titular_sul',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
  },
  {
    id: 'prop_sul_2',
    fazenda_id: 'prop_sul_2',
    fazenda_nome: 'Propriedade Sul Dois',
    produtor_id: 'titular_sul_2',
    regiao: 'Sul',
    microregiao: 'RS - Norte',
  },
  {
    id: 'prop_centro',
    fazenda_id: 'prop_centro',
    fazenda_nome: 'Propriedade Centro',
    produtor_id: 'titular_centro',
    regiao: 'Centro-Oeste',
    microregiao: 'Goiás Central',
  },
];

const baseForm = {
  nome: 'Usuário Teste',
  email: 'usuario.teste@example.com',
  telefone: '',
  documento: '',
  status: 'ativo',
  observacoes: '',
};

const run = async () => {
  await test('produtor salva somente vinculos com propriedades existentes', () => {
    const payload = buildUsuarioAdminPayload({
      form: {
        ...baseForm,
        perfil: 'produtor',
        vinculosPropriedades: [
          {
            propriedade_id: 'prop_sul_1',
            tipo_vinculo: 'titular',
            principal: true,
          },
        ],
      },
      propriedades,
    });

    assert.equal(payload.produtor_id, 'titular_sul');
    assert.deepEqual(payload.vinculos_propriedades, [
      {
        usuario_id: '',
        propriedade_id: 'prop_sul_1',
        tipo_vinculo: 'titular',
        principal: true,
      },
    ]);
    assert.deepEqual(payload.propriedades_atribuidas, []);
  });

  await test('colaborador recebe propriedades automaticamente por regiao e microregiao', () => {
    const payload = buildUsuarioAdminPayload({
      form: {
        ...baseForm,
        perfil: 'colaborador',
        regiao: 'sul',
        cargo: 'Colaborador de Campo',
        subRegioesText: 'RS - Norte',
        vinculosPropriedades: [
          {
            propriedade_id: 'prop_centro',
            tipo_vinculo: 'colaborador_atribuido',
            principal: true,
          },
        ],
      },
      propriedades,
    });

    assert.deepEqual(payload.sub_regioes, ['RS - Norte']);
    assert.deepEqual(payload.propriedades_atribuidas, ['prop_sul_1', 'prop_sul_2']);
    assert.deepEqual(
      payload.vinculos_propriedades.map((vinculo) => vinculo.tipo_vinculo),
      ['colaborador_atribuido', 'colaborador_atribuido']
    );
    assert.equal(payload.vinculos_propriedades[0].principal, true);
    assert.equal(payload.vinculos_propriedades[1].principal, false);
    assert.deepEqual(payload.vinculos_microregioes, [
      { regiao: 'sul', microregiao: 'RS - Norte' },
    ]);
  });

  await test('atribuicao automatica tolera acentos e respeita a regiao selecionada', () => {
    const vinculos = buildVinculosPropriedadesPorMicroregioes({
      propriedades: [
        ...propriedades,
        {
          id: 'prop_outra_regiao',
          fazenda_id: 'prop_outra_regiao',
          regiao: 'Norte',
          microregiao: 'Goiás Central',
        },
      ],
      regiao: 'Centro Oeste',
      microregioes: ['Goias Central'],
    });

    assert.deepEqual(vinculos, []);

    const vinculosComAcento = buildVinculosPropriedadesPorMicroregioes({
      propriedades,
      regiao: 'Centro-Oeste',
      microregioes: ['Goias Central'],
    });

    assert.deepEqual(vinculosComAcento.map((vinculo) => vinculo.propriedade_id), ['prop_centro']);
  });

  await test('admin permanece sem vinculos operacionais obrigatorios', () => {
    const payload = buildUsuarioAdminPayload({
      form: {
        ...baseForm,
        perfil: 'admin',
        nivelAdministrativo: 'global',
        regiao: 'Sul',
        subRegioesText: 'RS - Norte',
        vinculosPropriedades: [
          {
            propriedade_id: 'prop_sul_1',
            tipo_vinculo: 'responsavel',
            principal: true,
          },
        ],
      },
      propriedades,
    });

    assert.deepEqual(payload.vinculos_propriedades, []);
    assert.deepEqual(payload.vinculos_microregioes, []);
    assert.deepEqual(payload.propriedades_atribuidas, []);
    assert.equal(payload.acesso_global, true);
  });

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} teste(s) falharam.`);
  } else {
    console.log('\nTodos os testes de usuarioAdminCompat passaram.');
  }
};

run().catch((error) => {
  failed += 1;
  process.exitCode = 1;
  console.error(error);
});
