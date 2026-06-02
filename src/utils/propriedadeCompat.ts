type CompatRecord = Record<string, any>;

const isRecord = (value: unknown): value is CompatRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: CompatRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return undefined;
};

const hasAnyOwn = (value: CompatRecord, keys: string[]): boolean =>
  keys.some((key) => hasOwn(value, key));

const propriedadeContextKeys = [
  'propriedade_id',
  'propriedadeId',
  'propriedade_nome',
  'propriedadeNome',
  'fazenda_id',
  'fazendaId',
  'fazenda_nome',
  'fazendaNome',
  'fazenda',
  'proprietario_id',
  'produtor_nome',
  'area_total',
  'cultura_atual',
  'cidade',
  'estado',
  'regiao',
  'microregiao',
  'titulo',
  'categoria',
  'talhao',
  'data_visita',
  'tecnico_responsavel',
  'objetivo',
  'data_atividade',
  'tipo_atividade',
  'colaborador_responsavel',
  'poligono',
  'ano',
];

const isUsuarioPuro = (input: CompatRecord): boolean =>
  hasOwn(input, 'perfil') && !hasAnyOwn(input, propriedadeContextKeys);

const permiteProdutorIdComoPropriedade = (input: CompatRecord): boolean =>
  hasAnyOwn(input, propriedadeContextKeys) && !isUsuarioPuro(input);

// Ponte temporaria para migracao: le campos futuros e legados sem remover aliases antigos.
// Nao substitui backend/contrato real; a remocao de fazenda*/produtor_id/proprietario_id fica para fase futura.
export const getPropriedadeId = (input: unknown): string | undefined => {
  if (!isRecord(input)) return undefined;

  return firstNonEmptyString(
    input.propriedade_id,
    input.propriedadeId,
    input.fazenda_id,
    input.fazendaId,
    permiteProdutorIdComoPropriedade(input) ? input.produtor_id : undefined
  );
};

export const getPropriedadeNome = (input: unknown): string | undefined => {
  if (!isRecord(input)) return undefined;

  return firstNonEmptyString(
    input.propriedade_nome,
    input.propriedadeNome,
    input.fazenda_nome,
    input.fazendaNome,
    input.nome
  );
};

export const getTitularId = (input: unknown): string | undefined => {
  if (!isRecord(input)) return undefined;

  return firstNonEmptyString(
    input.titular_id,
    input.titularId,
    input.proprietario_id,
    input.produtor_id
  );
};

export const getTitularNome = (input: unknown): string | undefined => {
  if (!isRecord(input)) return undefined;

  return firstNonEmptyString(
    input.titular_nome,
    input.titularNome,
    input.proprietario_nome,
    input.produtor_nome,
    input.nome_titular
  );
};

export const withPropriedadeCompat = <T>(input: T): T => {
  if (!isRecord(input)) return input;

  const record = input as CompatRecord;
  const propriedadeId = getPropriedadeId(record);
  if (!propriedadeId) {
    return { ...record } as T;
  }

  return {
    ...record,
    propriedade_id: record.propriedade_id ?? propriedadeId,
    propriedadeId: record.propriedadeId ?? propriedadeId,
  } as T;
};

export const withTitularCompat = <T>(input: T): T => {
  if (!isRecord(input)) return input;

  const record = input as CompatRecord;
  const titularId = getTitularId(record);
  if (!titularId) {
    return { ...record } as T;
  }

  return {
    ...record,
    titular_id: record.titular_id ?? titularId,
    titularId: record.titularId ?? titularId,
  } as T;
};
