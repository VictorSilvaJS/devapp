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

const cloneRecord = <T extends Record<string, any>>(record: T): T => ({ ...record });

const matchesQuery = (record: Record<string, any>, query?: Record<string, any>) => {
  const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined);
  return entries.every(([key, value]) => String(record[key]) === String(value));
};

export const readMockVisita = (record: any) => cloneRecord(toVisitaCompativelBorda(record));

export const listMockVisitas = (records: any[]) => records.map(readMockVisita);

export const filterMockVisitas = (records: any[], query?: Record<string, any>) =>
  listMockVisitas(records).filter((record) => matchesQuery(record, query));

export const persistMockVisita = ({ id, data, existing }: { id?: any; data: any; existing?: any }) => {
  const current = existing ? readMockVisita(existing) : null;
  const nextFazendaId = data?.fazenda_id ?? data?.produtor_id ?? current?.fazenda_id;
  const normalized = normalizeVisita({
    ...(current || {}),
    ...(data || {}),
    id: id ?? data?.id ?? current?.id,
    fazenda_id: nextFazendaId,
    status: data?.status ?? current?.status ?? 'agendada',
    fotos: data?.fotos ?? current?.fotos ?? [],
  });

  return toVisitaCompativelBorda(normalized);
};

export const readMockCadernoCampo = (record: any) => cloneRecord(toCadernoCampoCompativelBorda(record));

export const listMockCadernosCampo = (records: any[]) => records.map(readMockCadernoCampo);

export const filterMockCadernosCampo = (records: any[], query?: Record<string, any>) =>
  listMockCadernosCampo(records).filter((record) => matchesQuery(record, query));

export const persistMockCadernoCampo = ({ id, data, existing }: { id?: any; data: any; existing?: any }) => {
  const current = existing ? readMockCadernoCampo(existing) : null;
  const nextFazendaId = data?.fazenda_id ?? data?.produtor_id ?? current?.fazenda_id;
  const normalized = normalizeCadernoCampo({
    ...(current || {}),
    ...(data || {}),
    id: id ?? data?.id ?? current?.id,
    fazenda_id: nextFazendaId,
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
  const nextFazendaId = data?.fazenda_id ?? data?.produtor_id ?? current?.fazenda_id;
  const normalized = normalizeMapa({
    ...(current || {}),
    ...(data || {}),
    id: id ?? data?.id ?? current?.id,
    fazenda_id: nextFazendaId,
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
  const nextFazendaId = data?.fazenda_id ?? data?.produtor_id ?? current?.fazenda_id;
  const normalized = normalizeLimiteArea({
    ...(current || {}),
    ...(data || {}),
    id: id ?? data?.id ?? current?.id,
    fazenda_id: nextFazendaId,
    data_upload: data?.data_upload ?? current?.data_upload ?? new Date().toISOString(),
    disponivel_offline: data?.disponivel_offline ?? current?.disponivel_offline ?? true,
  });

  return toLimiteAreaCompativelBorda(normalized);
};
