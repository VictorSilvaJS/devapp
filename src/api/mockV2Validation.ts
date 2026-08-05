import {
  ORGANIZACAO_TCHE_ID,
  type MockV2State,
  type RecursoPropriedadeV2,
} from '../domain/contractsV2';

const LEGACY_KEYS = new Set([
  'fazenda',
  'fazenda_id',
  'fazendaId',
  'fazenda_nome',
  'fazendaNome',
  'propriedadeId',
  'propriedadeNome',
  'produtor_id',
  'produtor_nome',
  'proprietario_id',
  'proprietario_nome',
  'titularId',
  'titularNome',
  'talhaoId',
  'talhao',
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

  if (state.dataset) {
    if (!state.dataset.id?.trim() || state.dataset.tipo !== 'demonstracao') {
      throw new Error('dataset: identificação demonstrativa inválida');
    }
    if (!state.dataset.fonte?.trim() || !/^[a-f0-9]{64}$/i.test(state.dataset.fonte_sha256)) {
      throw new Error('dataset: fonte e SHA-256 válidos são obrigatórios');
    }
    if (Number.isNaN(Date.parse(state.dataset.gerado_em))) {
      throw new Error('dataset.gerado_em: data inválida');
    }
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

  const emails = new Set<string>();
  for (const usuario of state.usuarios) {
    if (!['admin', 'colaborador', 'produtor'].includes(usuario.perfil)) {
      throw new Error(`usuarios.perfil: perfil inválido ${usuario.perfil}`);
    }
    if (!['ativo', 'inativo', 'pendente'].includes(usuario.status)) {
      throw new Error(`usuarios.status: status inválido ${usuario.status}`);
    }
    if (!usuario.nome?.trim() || !usuario.email?.trim()) {
      throw new Error('usuarios: nome e e-mail são obrigatórios');
    }
    const email = usuario.email.trim().toLowerCase();
    if (emails.has(email)) throw new Error(`usuarios.email: duplicado ${usuario.email}`);
    emails.add(email);
  }

  for (const produtor of state.produtores) {
    const usuario = state.usuarios.find((item) => item.id === produtor.usuario_id);
    if (!usuario || usuario.perfil !== 'produtor') {
      throw new Error(`produtores.usuario_id: usuário Produtor inexistente ${produtor.usuario_id}`);
    }
    if (!produtor.nome?.trim() || !['ativo', 'inativo'].includes(produtor.status)) {
      throw new Error(`produtores: nome ou status inválido em ${produtor.id}`);
    }
  }

  for (const propriedade of state.propriedades) {
    if (!produtorIds.has(propriedade.titular_id)) {
      throw new Error(`propriedades.titular_id: Produtor inexistente ${propriedade.titular_id}`);
    }
    if (!propriedade.municipio_id || !propriedade.municipio_nome || !propriedade.uf_id || !propriedade.uf_sigla) {
      throw new Error(`propriedades.localizacao: Município e UF são obrigatórios`);
    }
    if (!['ativa', 'inativa'].includes(propriedade.status)) {
      throw new Error(`propriedades.status: status inválido ${propriedade.status}`);
    }
    if (!propriedade.nome?.trim()) throw new Error(`propriedades.nome: obrigatório em ${propriedade.id}`);
  }

  const activeLinkKeys = new Set<string>();
  for (const link of state.usuarios_propriedades) {
    if (!usuarioIds.has(link.usuario_id)) {
      throw new Error(`usuarios_propriedades.usuario_id: usuário inexistente ${link.usuario_id}`);
    }
    if (!propriedadeIds.has(link.propriedade_id)) {
      throw new Error(`usuarios_propriedades.propriedade_id: Propriedade inexistente ${link.propriedade_id}`);
    }
    if (!['titular', 'usuario_autorizado', 'colaborador'].includes(link.tipo_vinculo)) {
      throw new Error(`usuarios_propriedades.tipo_vinculo: tipo inválido ${link.tipo_vinculo}`);
    }
    if (!['ativo', 'inativo'].includes(link.status)) {
      throw new Error(`usuarios_propriedades.status: status inválido ${link.status}`);
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
    if (!['ativo', 'inativo'].includes(talhao.status)) {
      throw new Error(`talhoes.status: status inválido ${talhao.status}`);
    }
    if (!talhao.nome?.trim()) throw new Error(`talhoes.nome: obrigatório em ${talhao.id}`);
    talhaoPorId.set(talhao.id, talhao.propriedade_id);
  }
  if (talhaoPorId.size !== talhaoIds.size) throw new Error('talhoes: índice inconsistente');

  assertOperationalResources('visitas', state.visitas, propriedadeIds, talhaoPorId);
  assertOperationalResources('cadernos', state.cadernos, propriedadeIds, talhaoPorId);
  assertOperationalResources('materiais', state.materiais, propriedadeIds, talhaoPorId);

  return true;
};
