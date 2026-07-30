export const SELF_TERRITORIAL_UPDATE_FORBIDDEN_MESSAGE =
  'Vínculos territoriais só podem ser alterados por um administrador autorizado.';

export const SELF_TERRITORIAL_UPDATE_FORBIDDEN_CODE =
  'SELF_TERRITORIAL_UPDATE_FORBIDDEN';

const territorialSelfServiceFields = new Set([
  'territorio',
  'regiao',
  'regional',
  'regional_id',
  'area_operacional',
  'area_operacional_id',
  'microregiao',
  'sub_regioes',
  'vinculos_microregioes',
  'vinculos_regionais',
  'vinculos_areas_operacionais',
  'propriedades_atribuidas',
  'vinculos_propriedades',
  'regioes_acesso',
  'acesso_global',
]);

export const getSelfTerritorialUpdateFields = (updates: any): string[] => {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return [];
  }

  return Object.keys(updates).filter((field) =>
    territorialSelfServiceFields.has(field)
  );
};

export const sanitizeSelfProfileUpdate = (updates: any) => {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return {};
  }

  const forbiddenFields = getSelfTerritorialUpdateFields(updates);
  if (forbiddenFields.length > 0) {
    const error = new Error(SELF_TERRITORIAL_UPDATE_FORBIDDEN_MESSAGE);
    (error as any).code = SELF_TERRITORIAL_UPDATE_FORBIDDEN_CODE;
    (error as any).fields = forbiddenFields;
    throw error;
  }

  return { ...updates };
};
