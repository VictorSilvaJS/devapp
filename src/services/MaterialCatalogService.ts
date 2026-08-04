import { Mapa } from '../api/mock';
import { getMapaFazendaId } from '../utils/acessoControle';
import {
  materialTecnicoImportToMapaCompat,
} from '../utils/materialTecnicoToMapaCompat';
import {
  pngMapImportToMapaCompat,
} from '../utils/pngMapToMapaCompat';
import {
  prescriptionZipImportToMapaCompat,
} from '../utils/prescriptionZipToMapaCompat';
import type { PngMapImportMetadata } from '../types/anexoPngLocal';
import type { PrescriptionZipImportMetadata } from '../types/anexoPrescricaoZipLocal';
import type { MaterialTecnicoImportMetadata } from '../types/materialTecnicoLocal';
import { MaterialTecnicoImportService } from './MaterialTecnicoImportService';
import { PngMapImportService } from './PngMapImportService';
import { PrescriptionZipImportService } from './PrescriptionZipImportService';

export const MATERIAL_CATALOG_CATEGORIES = [
  'fertilidade',
  'correcao',
  'prescricao',
] as const;

export type MaterialCatalogPerfil =
  | 'admin'
  | 'colaborador'
  | 'produtor'
  | string
  | null
  | undefined;

export interface MaterialCatalogQuery {
  propriedadeIds: string[];
  perfil?: MaterialCatalogPerfil;
}

export interface MaterialCatalogSources {
  mapasBase: Record<string, any>[];
  pngImports: PngMapImportMetadata[];
  prescriptionZipImports: PrescriptionZipImportMetadata[];
  materialTecnicoImports: MaterialTecnicoImportMetadata[];
}

export interface MaterialCatalogResult {
  materiais: Record<string, any>[];
  fontes: MaterialCatalogSources;
}

export interface MaterialCatalogServiceDeps {
  listMapasBase?: () => Promise<Record<string, any>[]>;
  listPngImports?: () => Promise<PngMapImportMetadata[]>;
  listPrescriptionZipImports?: () => Promise<PrescriptionZipImportMetadata[]>;
  listMaterialTecnicoImports?: () => Promise<MaterialTecnicoImportMetadata[]>;
}

type MaterialCatalogSource =
  | 'material_tecnico_local'
  | 'png_local_legado'
  | 'zip_local_legado'
  | 'mapa_base';

const ACTIVE_BASE_STATUSES = new Set(['ativo', 'liberado', 'publicado', 'disponivel']);

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const normalizeKeyPart = (value: unknown): string => {
  const normalized = firstNonEmptyString(value);
  return normalized
    ? normalized
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\\/g, '/')
        .toLowerCase()
        .trim()
    : '';
};

const normalizePropriedadeIds = (ids: string[] = []): Set<string> =>
  new Set(ids.map(normalizeKeyPart).filter(Boolean));

const getMaterialPropriedadeId = (material: Record<string, any>): string =>
  firstNonEmptyString(
    material?.propriedade_id,
    material?.propriedadeId,
    material?.fazenda_id,
    material?.fazendaId,
    material?.produtor_id,
    getMapaFazendaId(material)
  );

const pertenceAoEscopo = (
  material: Record<string, any>,
  propriedadeIds: Set<string>
): boolean => propriedadeIds.has(normalizeKeyPart(getMaterialPropriedadeId(material)));

const isCategoriaMaterial = (material: Record<string, any>): boolean =>
  MATERIAL_CATALOG_CATEGORIES.includes(material?.categoria);

const isPublishedMaterial = (
  material: Record<string, any>,
  source: MaterialCatalogSource
): boolean => {
  const status = normalizeKeyPart(material?.status);
  if (source !== 'mapa_base') return status === 'ativo';
  return !status || ACTIVE_BASE_STATUSES.has(status);
};

const isAvailableMaterial = (
  material: Record<string, any>,
  source: MaterialCatalogSource
): boolean => {
  if (source !== 'mapa_base') {
    return Boolean(firstNonEmptyString(material?.arquivo_uri_local));
  }

  const disponibilidades = [
    material?.disponivel_download,
    material?.disponivel_para_download,
  ].filter((value): value is boolean => typeof value === 'boolean');

  if (disponibilidades.length > 0) return disponibilidades.some(Boolean);

  return Boolean(firstNonEmptyString(material?.arquivo_url, material?.arquivo_uri_local));
};

const isVisibleForPerfil = (
  material: Record<string, any>,
  perfil: MaterialCatalogPerfil
): boolean => perfil !== 'produtor' || material?.visivel_para_produtor !== false;

const getMaterialYear = (material: Record<string, any>): string => {
  const explicit = firstNonEmptyString(material?.ano);
  if (/^\d{4}$/.test(explicit)) return explicit;

  const dateValue = firstNonEmptyString(
    material?.data_criacao,
    material?.importado_em,
    material?.created_at
  );
  const year = dateValue ? new Date(dateValue).getFullYear() : Number.NaN;
  return Number.isInteger(year) ? String(year) : '';
};

const getMaterialVersion = (material: Record<string, any>): string =>
  firstNonEmptyString(material?.versao, material?.version);

const getMaterialDedupKey = (material: Record<string, any>): string => {
  const originalFileName = normalizeKeyPart(material?.arquivo_nome_original);
  if (!originalFileName) return '';

  return [
    normalizeKeyPart(getMaterialPropriedadeId(material)),
    originalFileName,
    normalizeKeyPart(material?.categoria),
    normalizeKeyPart(material?.formato_arquivo),
    getMaterialYear(material),
    normalizeKeyPart(
      material?.talhao_id
      || material?.talhaoId
      || material?.talhao_nome
      || material?.talhao
      || 'propriedade_inteira'
    ),
    getMaterialVersion(material),
  ].join('|');
};

const getMaterialTimestamp = (material: Record<string, any>): number => {
  const value = firstNonEmptyString(
    material?.data_atualizacao,
    material?.atualizado_em,
    material?.data_criacao,
    material?.importado_em
  );
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const withCatalogSource = (
  material: Record<string, any>,
  source: MaterialCatalogSource
): Record<string, any> => ({
  ...material,
  material_catalog_source: source,
});

const buildCandidates = (fontes: MaterialCatalogSources) => [
  ...(fontes.materialTecnicoImports ?? []).map((metadata) => ({
    material: materialTecnicoImportToMapaCompat(metadata),
    source: 'material_tecnico_local' as const,
  })),
  ...(fontes.pngImports ?? []).map((metadata) => ({
    material: pngMapImportToMapaCompat(metadata),
    source: 'png_local_legado' as const,
  })),
  ...(fontes.prescriptionZipImports ?? []).map((metadata) => ({
    material: prescriptionZipImportToMapaCompat(metadata),
    source: 'zip_local_legado' as const,
  })),
  ...(fontes.mapasBase ?? []).map((material) => ({
    material,
    source: 'mapa_base' as const,
  })),
];

/**
 * Projeta todas as fontes legadas e atuais para o mesmo catalogo consultavel.
 * A ordem dos candidatos define a precedencia de deduplicacao: indice
 * unificado, PNG legado, ZIP legado e, por ultimo, fixture/base Mapa.
 */
export const buildMateriaisCatalogo = (
  fontes: MaterialCatalogSources,
  query: MaterialCatalogQuery
): Record<string, any>[] => {
  const propriedadeIds = normalizePropriedadeIds(query.propriedadeIds);
  if (propriedadeIds.size === 0) return [];

  const dedupKeys = new Set<string>();
  const sourceIds = new Set<string>();
  const materiais: Record<string, any>[] = [];

  for (const candidate of buildCandidates(fontes)) {
    const { material, source } = candidate;
    if (!pertenceAoEscopo(material, propriedadeIds)) continue;
    if (!isCategoriaMaterial(material)) continue;
    if (!isPublishedMaterial(material, source)) continue;
    if (!isAvailableMaterial(material, source)) continue;
    if (!isVisibleForPerfil(material, query.perfil)) continue;

    const sourceId = `${source}:${normalizeKeyPart(material?.id)}`;
    if (normalizeKeyPart(material?.id) && sourceIds.has(sourceId)) continue;

    const dedupKey = getMaterialDedupKey(material);
    if (dedupKey && dedupKeys.has(dedupKey)) continue;

    sourceIds.add(sourceId);
    if (dedupKey) dedupKeys.add(dedupKey);
    materiais.push(withCatalogSource(material, source));
  }

  return materiais.sort((a, b) => getMaterialTimestamp(b) - getMaterialTimestamp(a));
};

const filterSourcesByPropriedade = (
  fontes: MaterialCatalogSources,
  propriedadeIds: string[]
): MaterialCatalogSources => {
  const ids = normalizePropriedadeIds(propriedadeIds);
  if (ids.size === 0) {
    return {
      mapasBase: [],
      pngImports: [],
      prescriptionZipImports: [],
      materialTecnicoImports: [],
    };
  }

  return {
    mapasBase: (fontes.mapasBase ?? []).filter((item) => pertenceAoEscopo(item, ids)),
    pngImports: (fontes.pngImports ?? []).filter((item) => pertenceAoEscopo(item as any, ids)),
    prescriptionZipImports: (fontes.prescriptionZipImports ?? []).filter((item) => pertenceAoEscopo(item as any, ids)),
    materialTecnicoImports: (fontes.materialTecnicoImports ?? []).filter((item) => pertenceAoEscopo(item as any, ids)),
  };
};

export const createMaterialCatalogService = (
  deps: MaterialCatalogServiceDeps = {}
) => ({
  async consultarMateriais(query: MaterialCatalogQuery): Promise<MaterialCatalogResult> {
    const [mapasBase, pngImports, prescriptionZipImports, materialTecnicoImports] = await Promise.all([
      (deps.listMapasBase ?? (() => Mapa.list()))(),
      (deps.listPngImports ?? (() => PngMapImportService.listPngMapImports()))(),
      (deps.listPrescriptionZipImports
        ?? (() => PrescriptionZipImportService.listPrescriptionZipImports()))(),
      (deps.listMaterialTecnicoImports
        ?? (() => MaterialTecnicoImportService.listMaterialTecnicoImports()))(),
    ]);

    const fontes = filterSourcesByPropriedade({
      mapasBase,
      pngImports,
      prescriptionZipImports,
      materialTecnicoImports,
    }, query.propriedadeIds);

    return {
      materiais: buildMateriaisCatalogo(fontes, query),
      fontes,
    };
  },
});

export const MaterialCatalogService = createMaterialCatalogService();
