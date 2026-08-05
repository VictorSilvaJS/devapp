import {
  normalizeCadernoCampo,
  normalizeLimiteArea,
  normalizeMapa,
  normalizeVisita,
  toCadernoCampoCompativelBorda,
  toLimiteAreaCompativelBorda,
  toMapaCompativelBorda,
  toVisitaCompativelBorda,
} from '../domain';
import {
  buildCadernoLocalizacaoFields,
  clearCadernoLocalizacaoBundleFields,
  hasCadernoLocalizacaoFieldIntent,
  isCadernoLocalizacaoRemovalPatch,
} from '../utils/cadernoLocalizacaoCompat';
import { buildCadernoLocalizacaoSpatialFields } from '../utils/cadernoLocalizacaoSpatialCompat';
import { withCadernoLifecycleReadCompat } from '../utils/cadernoLifecycleCompat';
import { withVisitaLifecycleReadCompat } from '../utils/visitaLifecycleCompat';

const cloneRecord = <T extends Record<string, any>>(record: T): T => ({ ...record });

const matchesQuery = (record: Record<string, any>, query?: Record<string, any>) => {
  const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined);
  return entries.every(([key, value]) => String(record[key]) === String(value));
};

export const readMockVisita = (record: any) =>
  cloneRecord(withVisitaLifecycleReadCompat(toVisitaCompativelBorda(record)));

export const listMockVisitas = (records: any[]) => records.map(readMockVisita);

export const filterMockVisitas = (records: any[], query?: Record<string, any>) =>
  listMockVisitas(records).filter((record) => matchesQuery(record, query));

export const persistMockVisita = ({ id, data, existing }: { id?: any; data: any; existing?: any }) => {
  const current = existing ? readMockVisita(existing) : null;
  const nextPropriedadeId = data?.propriedade_id
    ?? data?.fazenda_id
    ?? data?.produtor_id
    ?? current?.propriedade_id
    ?? current?.fazenda_id;
  const normalized = normalizeVisita({
    ...(current || {}),
    ...(data || {}),
    id: id ?? data?.id ?? current?.id,
    propriedade_id: nextPropriedadeId,
    status: data?.status ?? current?.status ?? 'agendada',
    fotos: data?.fotos ?? current?.fotos ?? [],
  });

  return toVisitaCompativelBorda(normalized);
};

export const readMockCadernoCampo = (record: any) =>
  cloneRecord(withCadernoLifecycleReadCompat(toCadernoCampoCompativelBorda(record)));

export const listMockCadernosCampo = (records: any[]) => records.map(readMockCadernoCampo);

export const filterMockCadernosCampo = (records: any[], query?: Record<string, any>) =>
  listMockCadernosCampo(records).filter((record) => matchesQuery(record, query));

export const persistMockCadernoCampo = ({ id, data, existing }: { id?: any; data: any; existing?: any }) => {
  const current = existing ? readMockCadernoCampo(existing) : null;
  const nextPropriedadeId = data?.propriedade_id
    ?? data?.fazenda_id
    ?? data?.fazendaId
    ?? data?.produtor_id
    ?? current?.propriedade_id
    ?? current?.fazenda_id
    ?? current?.fazendaId;
  const hasLocalizacaoIntent = hasCadernoLocalizacaoFieldIntent(data);
  let localizacaoFields = buildCadernoLocalizacaoFields(current);
  let localizacaoSpatialFields = buildCadernoLocalizacaoSpatialFields(current);

  if (hasLocalizacaoIntent) {
    if (isCadernoLocalizacaoRemovalPatch(data)) {
      localizacaoFields = {};
      localizacaoSpatialFields = {};
    } else {
      localizacaoFields = buildCadernoLocalizacaoFields(data);
      if (Object.keys(localizacaoFields).length === 0) {
        throw new Error('CadernoCampo.localizacao: Grupo parcial de localização inválido para escrita.');
      }
      localizacaoSpatialFields = buildCadernoLocalizacaoSpatialFields(data);
    }
  }

  const normalized = normalizeCadernoCampo({
    ...clearCadernoLocalizacaoBundleFields(current || {}),
    ...clearCadernoLocalizacaoBundleFields(data || {}),
    ...localizacaoFields,
    ...localizacaoSpatialFields,
    id: id ?? data?.id ?? current?.id,
    propriedade_id: nextPropriedadeId,
    visivel_para_produtor: data?.visivel_para_produtor ?? current?.visivel_para_produtor ?? true,
    fotos: data?.fotos ?? current?.fotos ?? [],
    data_criacao: data?.data_criacao ?? current?.data_criacao ?? new Date().toISOString(),
  });

  return toCadernoCampoCompativelBorda(normalized);
};

export const readMockMapa = (record: any) => cloneRecord(toMapaCompativelBorda(record));

export const listMockMapas = (records: any[]) => records.map(readMockMapa);

export const filterMockMapas = (records: any[], query?: Record<string, any>) =>
  listMockMapas(records).filter((record) => matchesQuery(record, query));

export const persistMockMapa = ({ id, data, existing }: { id?: any; data: any; existing?: any }) => {
  const current = existing ? readMockMapa(existing) : null;
  const nextPropriedadeId = data?.propriedade_id
    ?? data?.fazenda_id
    ?? data?.produtor_id
    ?? current?.propriedade_id
    ?? current?.fazenda_id;
  const normalized = normalizeMapa({
    ...(current || {}),
    ...(data || {}),
    id: id ?? data?.id ?? current?.id,
    propriedade_id: nextPropriedadeId,
    data_criacao: data?.data_criacao ?? current?.data_criacao ?? new Date().toISOString(),
    disponivel_download:
      data?.disponivel_download ??
      data?.disponivel_para_download ??
      current?.disponivel_download ??
      true,
  });

  return toMapaCompativelBorda(normalized);
};

export const readMockLimiteArea = (record: any) => cloneRecord(toLimiteAreaCompativelBorda(record));

export const listMockLimitesArea = (records: any[]) => records.map(readMockLimiteArea);

export const filterMockLimitesArea = (records: any[], query?: Record<string, any>) =>
  listMockLimitesArea(records).filter((record) => matchesQuery(record, query));

export const persistMockLimiteArea = ({ id, data, existing }: { id?: any; data: any; existing?: any }) => {
  const current = existing ? readMockLimiteArea(existing) : null;
  const nextPropriedadeId = data?.propriedade_id
    ?? data?.fazenda_id
    ?? data?.produtor_id
    ?? current?.propriedade_id
    ?? current?.fazenda_id;
  const normalized = normalizeLimiteArea({
    ...(current || {}),
    ...(data || {}),
    id: id ?? data?.id ?? current?.id,
    propriedade_id: nextPropriedadeId,
    data_upload: data?.data_upload ?? current?.data_upload ?? new Date().toISOString(),
    disponivel_offline: data?.disponivel_offline ?? current?.disponivel_offline ?? true,
  });

  return toLimiteAreaCompativelBorda(normalized);
};
