import {
  normalizeCadernoCampo,
  normalizeFazenda,
  normalizeMapa,
  normalizeVisita,
} from '../domain';
import {
  ORGANIZACAO_TCHE_ID,
  type MockV2State,
  type PerfilUsuarioV2,
  type StatusCadastroV2,
  type StatusUsuarioV2,
  type TipoVinculoPropriedadeV2,
} from '../domain/contractsV2';
import type { MockLocalState } from './mockLocalPersistence';

const RUNTIME_ONLY_OR_LEGACY_KEYS = new Set([
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

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const stripRuntimeAliases = (value: unknown): any => {
  if (Array.isArray(value)) return value.map(stripRuntimeAliases);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce<Record<string, unknown>>((result, [key, nested]) => {
    if (!RUNTIME_ONLY_OR_LEGACY_KEYS.has(key)) {
      result[key] = stripRuntimeAliases(nested);
    }
    return result;
  }, {});
};

const toRuntimeUsers = (state: MockV2State) => {
  const produtorIdPorUsuario = new Map(
    state.produtores.map((produtor) => [produtor.usuario_id, produtor.id])
  );

  return state.usuarios.map((usuario) => ({
    ...clone(usuario),
    ativo: usuario.status === 'ativo',
    ...(usuario.perfil === 'produtor' && produtorIdPorUsuario.has(usuario.id)
      ? { produtor_id: produtorIdPorUsuario.get(usuario.id) }
      : {}),
  }));
};

const toRuntimeProperties = (state: MockV2State) => {
  const produtorPorId = new Map(state.produtores.map((produtor) => [produtor.id, produtor]));
  const usuarioPorId = new Map(state.usuarios.map((usuario) => [usuario.id, usuario]));

  return state.propriedades.map((propriedade) => {
    const produtor = produtorPorId.get(propriedade.titular_id);
    const usuarioTitular = produtor ? usuarioPorId.get(produtor.usuario_id) : undefined;
    const titularNome = produtor?.nome || usuarioTitular?.nome || '';

    return {
      ...clone(propriedade),
      status: propriedade.status === 'inativa' ? 'inativo' : 'ativo',
      propriedade_id: propriedade.id,
      propriedade_nome: propriedade.nome,
      produtor_nome: titularNome,
      titular_nome: titularNome,
      cidade: propriedade.municipio_nome,
      estado: propriedade.uf_sigla,
      cultura_atual: propriedade.cultura_principal,
    };
  });
};

const toRuntimeLinks = (state: MockV2State) => {
  const principalDefinido = new Set<string>();

  return state.usuarios_propriedades.map((link) => {
    const principal = link.status === 'ativo' && !principalDefinido.has(link.usuario_id);
    if (principal) principalDefinido.add(link.usuario_id);
    return { ...clone(link), principal };
  });
};

export const projectMockV2ToRuntime = (state: MockV2State): MockLocalState => ({
  users: toRuntimeUsers(state),
  produtores: toRuntimeProperties(state),
  usuarioPropriedade: toRuntimeLinks(state),
  usuarioMicroregiao: [],
  visitas: clone(state.visitas),
  cadernos: clone(state.cadernos),
  mapas: clone(state.materiais),
});

const toStatusUsuario = (record: any): StatusUsuarioV2 => {
  if (record?.status === 'ativo' || record?.status === 'inativo' || record?.status === 'pendente') {
    return record.status;
  }
  return record?.ativo === false ? 'inativo' : 'ativo';
};

const toStatusCadastro = (record: any): StatusCadastroV2 =>
  record?.status === 'inativo' ? 'inativo' : 'ativo';

const toV2Users = (records: any[]): MockV2State['usuarios'] => records.map((record) => ({
  id: String(record?.id || '').trim(),
  organizacao_id: ORGANIZACAO_TCHE_ID,
  nome: String(record?.nome || record?.full_name || '').trim(),
  email: String(record?.email || '').trim(),
  perfil: record?.perfil as PerfilUsuarioV2,
  status: toStatusUsuario(record),
  ...(record?.telefone !== undefined ? { telefone: String(record.telefone) } : {}),
  ...(record?.documento !== undefined ? { documento: String(record.documento) } : {}),
  ...(record?.observacoes !== undefined ? { observacoes: String(record.observacoes) } : {}),
}));

const toV2Properties = (
  records: any[],
  baseProperties: MockV2State['propriedades']
): MockV2State['propriedades'] => records.map((record) => {
  const canonical = normalizeFazenda(record);
  const existing = baseProperties.find((property) => property.id === canonical.id);
  const municipioNome = String(record?.municipio_nome || canonical.cidade || '').trim();
  const ufSigla = String(record?.uf_sigla || canonical.estado || '').trim().toUpperCase();
  const municipioId = String(
    record?.municipio_id
    || (existing?.municipio_nome === municipioNome ? existing.municipio_id : '')
  ).trim();
  const ufId = String(
    record?.uf_id
    || (existing?.uf_sigla === ufSigla ? existing.uf_id : '')
  ).trim();

  return {
    id: canonical.id,
    organizacao_id: ORGANIZACAO_TCHE_ID,
    titular_id: canonical.titular_id,
    nome: canonical.nome,
    municipio_id: municipioId,
    municipio_nome: municipioNome,
    uf_id: ufId,
    uf_sigla: ufSigla,
    ...(canonical.area_total !== undefined ? { area_total: canonical.area_total } : {}),
    ...(canonical.cultura_atual !== undefined ? { cultura_principal: canonical.cultura_atual } : {}),
    status: canonical.status === 'inativo' || canonical.status === 'inativa' ? 'inativa' : 'ativa',
  };
});

const toV2Links = (records: any[]): MockV2State['usuarios_propriedades'] => records.map((record) => ({
  id: String(record?.id || `up_${record?.usuario_id}_${record?.propriedade_id}_${record?.tipo_vinculo}`).trim(),
  organizacao_id: ORGANIZACAO_TCHE_ID,
  usuario_id: String(record?.usuario_id || '').trim(),
  propriedade_id: String(record?.propriedade_id || '').trim(),
  tipo_vinculo: record?.tipo_vinculo as TipoVinculoPropriedadeV2,
  status: toStatusCadastro(record),
}));

const toV2Resources = (
  records: any[],
  normalize: (record: any) => object
): MockV2State['materiais'] => records.map((record) => ({
  ...stripRuntimeAliases(normalize(record)),
  id: String(record?.id || '').trim(),
  organizacao_id: ORGANIZACAO_TCHE_ID,
}));

export const mergeRuntimeIntoMockV2 = (
  base: MockV2State,
  runtime: MockLocalState
): MockV2State => ({
  organizacao: clone(base.organizacao),
  usuarios: toV2Users(runtime.users),
  produtores: clone(base.produtores),
  propriedades: toV2Properties(runtime.produtores, base.propriedades),
  usuarios_propriedades: toV2Links(runtime.usuarioPropriedade),
  talhoes: clone(base.talhoes),
  visitas: toV2Resources(runtime.visitas, normalizeVisita),
  cadernos: toV2Resources(runtime.cadernos, normalizeCadernoCampo),
  materiais: toV2Resources(runtime.mapas, normalizeMapa),
});
