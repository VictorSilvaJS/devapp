const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const FIXTURE_CODE_PATTERN = /^17H\d{3}(?:_[A-Z0-9]+)+$/i;
const SOIL_FILE_CODE_PATTERN = /^(?:PH|AR|MO|PP|KK)_\d{1,2}A\d{1,2}(?:\.[A-Z0-9]+)?$/i;

export const isInternalFixtureLabel = (value: unknown): boolean => {
  const normalized = firstNonEmptyString(value);
  return FIXTURE_CODE_PATTERN.test(normalized) || SOIL_FILE_CODE_PATTERN.test(normalized);
};

export const getMaterialPublicTitle = (material: any): string => {
  const title = firstNonEmptyString(material?.titulo);
  if (title && !isInternalFixtureLabel(title)) return title;

  return firstNonEmptyString(
    material?.elemento_label,
    material?.camada_label,
    material?.categoria_label,
    material?.subcategoria,
    'Material técnico',
  );
};

export const getMaterialPublicDescription = (material: any): string => {
  const description = firstNonEmptyString(material?.descricao, material?.observacoes);
  if (!description || isInternalFixtureLabel(description)) return '';

  const withoutOriginalName = description
    .replace(/(?:^|\s+)Arquivo original:\s*[^.]+\.?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return isInternalFixtureLabel(withoutOriginalName) ? '' : withoutOriginalName;
};

export const getMaterialVersionLabel = (material: any): string => {
  const value = material?.versao ?? material?.versao_dados;
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    const materialId = firstNonEmptyString(material?.id);
    if (
      /^m_sela1_/.test(materialId) &&
      firstNonEmptyString(material?.tipo_anexo) === 'anexo_fertilidade'
    ) {
      return 'v1';
    }
    return '';
  }

  const normalized = String(value).trim();
  return /^v/i.test(normalized) ? normalized : `v${normalized}`;
};

export const getMaterialScopeLabel = (material: any): string => {
  const scope = firstNonEmptyString(material?.escopo).toLowerCase();
  const fieldLabel = firstNonEmptyString(material?.talhao_nome, material?.talhao);

  if (scope === 'talhao') return fieldLabel || 'Talhão específico';
  if (scope === 'propriedade' || /propriedade inteira/i.test(fieldLabel)) {
    return 'Propriedade inteira';
  }

  return fieldLabel;
};
