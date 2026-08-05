import {
  ORGANIZACAO_TCHE_ID,
  type MockV2State,
  type RecursoPropriedadeV2,
} from '../domain/contractsV2';

const LEGACY_KEYS = new Set([
  'fazenda_id',
  'fazendaId',
  'fazenda_nome',
  'fazendaNome',
  'proprietario_id',
  'regiao',
  'microregiao',
  'sub_regioes',
  'vinculos_microregioes',
  'propriedades_atribuidas',
]);

const assertUniqueIds = (entity: string, records: Array<{ id: string }>) => {
  const ids = new Set<string>();
  for (const record of records) {
    if (!record?.id?.trim()) throw new Error(`${entity}.id: obrigatório`);
    if (ids.has(record.id)) throw new Error(`${entity}.id: duplicado ${record.id}`);
    ids.add(record.id);
  }
  return ids;
};

const assertOrganization = (entity: string, records: Array<{ organizacao_id: string }>) => {
  for (const record of records) {
    if (record.organizacao_id !== ORGANIZACAO_TCHE_ID) {
      throw new Error(`${entity}.organizacao_id: organização inválida`);
    }
  }
};

const assertNoLegacyKeys = (value: unknown, path = 'snapshot') => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoLegacyKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, nested] of Object.entries(value)) {
    if (LEGACY_KEYS.has(key)) throw new Error(`${path}.${key}: campo legado não permitido no v2`);
    assertNoLegacyKeys(nested, `${path}.${key}`);
  }
};

const assertOperationalResources = (
  entity: string,
  records: RecursoPropriedadeV2[],
  propriedadeIds: Set<string>,
  talhaoPorId: Map<string, string>
) => {
  assertUniqueIds(entity, records);
  assertOrganization(entity, records);

  for (const record of records) {
    if (!propriedadeIds.has(record.propriedade_id)) {
      throw new Error(`${entity}.propriedade_id: Propriedade inexistente ${record.propriedade_id}`);
    }
    if (record.talhao_id && talhaoPorId.get(record.talhao_id) !== record.propriedade_id) {
      throw new Error(`${entity}.talhao_id: Talhão não pertence à Propriedade`);
    }
  }
};

export const validateMockV2State = (state: MockV2State): true => {
  if (state?.organizacao?.id !== ORGANIZACAO_TCHE_ID || state.organizacao.status !== 'ativa') {
    throw new Error('organizacao: Tchê Fertilidade ativa é obrigatória');
  }

  assertNoLegacyKeys(state);

  const usuarioIds = assertUniqueIds('usuarios', state.usuarios);
  const produtorIds = assertUniqueIds('produtores', state.produtores);
  const propriedadeIds = assertUniqueIds('propriedades', state.propriedades);
  assertUniqueIds('usuarios_propriedades', state.usuarios_propriedades);
  const talhaoIds = assertUniqueIds('talhoes', state.talhoes);

  assertOrganization('usuarios', state.usuarios);
  assertOrganization('produtores', state.produtores);
  assertOrganization('propriedades', state.propriedades);
  assertOrganization('usuarios_propriedades', state.usuarios_propriedades);
  assertOrganization('talhoes', state.talhoes);

  for (const produtor of state.produtores) {
    const usuario = state.usuarios.find((item) => item.id === produtor.usuario_id);
    if (!usuario || usuario.perfil !== 'produtor') {
      throw new Error(`produtores.usuario_id: usuário Produtor inexistente ${produtor.usuario_id}`);
    }
  }

  for (const propriedade of state.propriedades) {
    if (!produtorIds.has(propriedade.titular_id)) {
      throw new Error(`propriedades.titular_id: Produtor inexistente ${propriedade.titular_id}`);
    }
    if (!propriedade.municipio_id || !propriedade.municipio_nome || !propriedade.uf_id || !propriedade.uf_sigla) {
      throw new Error(`propriedades.localizacao: Município e UF são obrigatórios`);
    }
  }

  const activeLinkKeys = new Set<string>();
  for (const link of state.usuarios_propriedades) {
    if (!usuarioIds.has(link.usuario_id)) {
      throw new Error(`usuarios_propriedades.usuario_id: usuário inexistente ${link.usuario_id}`);
    }
    if (!propriedadeIds.has(link.propriedade_id)) {
      throw new Error(`usuarios_propriedades.propriedade_id: Propriedade inexistente ${link.propriedade_id}`);
    }
    if (link.status === 'ativo') {
      const key = `${link.usuario_id}:${link.propriedade_id}:${link.tipo_vinculo}`;
      if (activeLinkKeys.has(key)) throw new Error(`usuarios_propriedades: vínculo ativo duplicado ${key}`);
      activeLinkKeys.add(key);
    }
  }

  for (const propriedade of state.propriedades) {
    const titular = state.produtores.find((item) => item.id === propriedade.titular_id)!;
    const titularLinks = state.usuarios_propriedades.filter((link) =>
      link.propriedade_id === propriedade.id
      && link.usuario_id === titular.usuario_id
      && link.tipo_vinculo === 'titular'
      && link.status === 'ativo'
    );
    if (titularLinks.length !== 1) {
      throw new Error(`propriedades.titular_id: exige um vínculo titular ativo em ${propriedade.id}`);
    }
  }

  const talhaoPorId = new Map<string, string>();
  for (const talhao of state.talhoes) {
    if (!propriedadeIds.has(talhao.propriedade_id)) {
      throw new Error(`talhoes.propriedade_id: Propriedade inexistente ${talhao.propriedade_id}`);
    }
    talhaoPorId.set(talhao.id, talhao.propriedade_id);
  }
  if (talhaoPorId.size !== talhaoIds.size) throw new Error('talhoes: índice inconsistente');

  assertOperationalResources('visitas', state.visitas, propriedadeIds, talhaoPorId);
  assertOperationalResources('cadernos', state.cadernos, propriedadeIds, talhaoPorId);
  assertOperationalResources('materiais', state.materiais, propriedadeIds, talhaoPorId);

  return true;
};

