const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }

  return '';
};

export const normalizeTalhaoLookup = (value: unknown): string =>
  firstNonEmptyString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const getTalhaoConsultaId = (talhao?: Record<string, any> | null): string =>
  firstNonEmptyString(talhao?.id, talhao?.talhao_id, talhao?.talhaoId, talhao?.limite_id, talhao?.limite_area_id);

export const getTalhaoStableId = (talhao?: Record<string, any> | null): string =>
  firstNonEmptyString(talhao?.talhao_id, talhao?.talhaoId);

export const getTalhaoConsultaNome = (talhao?: Record<string, any> | null): string =>
  firstNonEmptyString(talhao?.talhao_nome, talhao?.talhaoNome, talhao?.talhao, talhao?.nome);

export const getRegistroTalhaoId = (registro?: Record<string, any> | null): string =>
  firstNonEmptyString(registro?.talhao_id, registro?.talhaoId, registro?.limite_id, registro?.limite_area_id);

export const getRegistroTalhaoNome = (registro?: Record<string, any> | null): string =>
  firstNonEmptyString(registro?.talhao_nome, registro?.talhaoNome, registro?.talhao);

export const registroTemTalhao = (registro?: Record<string, any> | null): boolean =>
  !!firstNonEmptyString(getRegistroTalhaoId(registro), getRegistroTalhaoNome(registro));

export const registroPertenceAoTalhao = (
  registro?: Record<string, any> | null,
  talhao?: Record<string, any> | null
): boolean => {
  const talhaoId = normalizeTalhaoLookup(getTalhaoConsultaId(talhao));
  const registroTalhaoId = normalizeTalhaoLookup(getRegistroTalhaoId(registro));
  if (talhaoId && registroTalhaoId) return talhaoId === registroTalhaoId;

  const talhaoNome = normalizeTalhaoLookup(getTalhaoConsultaNome(talhao));
  const registroTalhaoNome = normalizeTalhaoLookup(getRegistroTalhaoNome(registro));
  return !!talhaoNome && !!registroTalhaoNome && talhaoNome === registroTalhaoNome;
};

export const filtrarRegistrosDoTalhao = <T extends Record<string, any>>(
  registros: T[] = [],
  talhao?: Record<string, any> | null
): T[] => registros.filter((registro) => registroPertenceAoTalhao(registro, talhao));

export const filtrarRegistrosGeraisDaPropriedade = <T extends Record<string, any>>(
  registros: T[] = []
): T[] => registros.filter((registro) => !registroTemTalhao(registro));

export const separarPeriodosPorTalhao = <T extends Record<string, any>>(
  periodos: T[] = [],
  talhao?: Record<string, any> | null
) => ({
  doTalhao: filtrarRegistrosDoTalhao(periodos, talhao),
  daPropriedade: filtrarRegistrosGeraisDaPropriedade(periodos),
});

const isMaterialPropriedadeInteira = (material?: Record<string, any> | null): boolean => {
  const escopo = firstNonEmptyString(material?.escopo, material?.scope);
  if (escopo === 'propriedade') return true;
  if (escopo === 'talhao') return false;

  const talhaoNome = normalizeTalhaoLookup(getRegistroTalhaoNome(material));
  const talhaoId = normalizeTalhaoLookup(getRegistroTalhaoId(material));
  if (talhaoId) return false;
  if (!talhaoNome) return true;

  return [
    'area total',
    'area inteira',
    'propriedade',
    'propriedade inteira',
    'toda propriedade',
  ].includes(talhaoNome);
};

export const separarMateriaisPorTalhao = <T extends Record<string, any>>(
  materiais: T[] = [],
  talhao?: Record<string, any> | null
) => ({
  doTalhao: materiais.filter((material) => registroPertenceAoTalhao(material, talhao)),
  daPropriedade: materiais.filter(isMaterialPropriedadeInteira),
});

export const getTalhaoOrigemDemarcacaoLabel = (
  source?: string | null,
  hasActiveGeoJson?: boolean
): string => {
  if (hasActiveGeoJson || source === 'geojson_local') return 'GeoJSON local ativo';
  if (source === 'geojson_local_fallback') return 'Seed/mock como fallback';
  return 'Seed/mock';
};
