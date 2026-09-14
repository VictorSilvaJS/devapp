import { normalizeAdministrativeAreaTotal } from './administrativeArea';
import type {
  AdministrativePropertyProjection, AdministrativeReasonCode,
  ChangeAdministrativePropertyStatusPayload, CreateAdministrativePropertyPayload,
  PatchAdministrativePropertyPayload, PropertyStatus,
} from './contracts';
import { decodeAdministrativeProperty, InvalidBackendResponseError, isCanonicalUuidV4 } from './decoders';

// D9/D10 and the structural/semantic rules of mp35c-routes/validation.
export const PROPERTY_REASON_CODES: readonly AdministrativeReasonCode[] = Object.freeze([
  'fim_relacao', 'mudanca_responsabilidade', 'cadastro_duplicado',
  'correcao_administrativa', 'suspensao_operacional', 'outro',
]);

export class InvalidAdministrativePropertyModelError extends Error {
  constructor(readonly field: string) {
    super(`Valor administrativo inválido: ${field}.`);
    this.name = 'InvalidAdministrativePropertyModelError';
  }
}

function invalid(field: string): never { throw new InvalidAdministrativePropertyModelError(field); }
function exact(value: unknown, allowed: readonly string[], required: readonly string[]) {
  if (typeof value !== 'object' || value === null || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return invalid('estrutura');
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) return invalid('campos');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return invalid('estrutura');
    result[key] = descriptor.value;
  }
  if (required.some((key) => !Object.hasOwn(result, key))) return invalid('obrigatorios');
  return result;
}
function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value !== value.trim()) return invalid(field);
  const normalized = value.normalize('NFC');
  if (!normalized || Array.from(normalized).length > max) return invalid(field);
  return normalized;
}
function version(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return invalid('versao');
  return value;
}
function uuid(value: unknown, field: string): string {
  if (!isCanonicalUuidV4(value)) return invalid(field);
  return value;
}
function municipalityId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9]{7}(?![\s\S])/u.test(value)) return invalid('municipio_id');
  return value;
}
function status(value: unknown): PropertyStatus {
  if (value !== 'ativa' && value !== 'inativa') return invalid('status');
  return value;
}
function area(value: unknown) {
  try { return normalizeAdministrativeAreaTotal(value); }
  catch { return invalid('area_total'); }
}

export function validateCreateAdministrativePropertyPayload(value: unknown) {
  const input = exact(value, ['nome', 'titular_id', 'municipio_id', 'status', 'area_total', 'cultura_principal'],
    ['nome', 'titular_id', 'municipio_id', 'status']);
  return Object.freeze({
    nome: text(input.nome, 'nome', 200), titular_id: uuid(input.titular_id, 'titular_id'),
    municipio_id: municipalityId(input.municipio_id), status: status(input.status),
    ...(Object.hasOwn(input, 'area_total') ? { area_total: area(input.area_total) } : {}),
    ...(Object.hasOwn(input, 'cultura_principal')
      ? { cultura_principal: text(input.cultura_principal, 'cultura_principal', 120) } : {}),
  }) satisfies CreateAdministrativePropertyPayload;
}

export function validatePatchAdministrativePropertyPayload(value: unknown) {
  const input = exact(value, ['versao', 'nome', 'municipio_id', 'area_total', 'cultura_principal'], ['versao']);
  if (Object.keys(input).length < 2) return invalid('alteracoes');
  return Object.freeze({
    versao: version(input.versao),
    ...(Object.hasOwn(input, 'nome') ? { nome: text(input.nome, 'nome', 200) } : {}),
    ...(Object.hasOwn(input, 'municipio_id') ? { municipio_id: municipalityId(input.municipio_id) } : {}),
    ...(Object.hasOwn(input, 'area_total') ? { area_total: input.area_total === null ? null : area(input.area_total) } : {}),
    ...(Object.hasOwn(input, 'cultura_principal') ? { cultura_principal: input.cultura_principal === null
      ? null : text(input.cultura_principal, 'cultura_principal', 120) } : {}),
  }) satisfies PatchAdministrativePropertyPayload;
}

export function validateChangeAdministrativePropertyStatusPayload(value: unknown) {
  const input = exact(value, ['versao', 'status', 'motivo', 'motivo_detalhe'], ['versao', 'status', 'motivo']);
  const motivo = PROPERTY_REASON_CODES.find((code) => code === input.motivo);
  if (motivo === undefined) return invalid('motivo');
  if (motivo === 'outro' && !Object.hasOwn(input, 'motivo_detalhe')) return invalid('motivo_detalhe');
  return Object.freeze({ versao: version(input.versao), status: status(input.status), motivo,
    ...(Object.hasOwn(input, 'motivo_detalhe')
      ? { motivo_detalhe: text(input.motivo_detalhe, 'motivo_detalhe', 300) } : {}),
  }) satisfies ChangeAdministrativePropertyStatusPayload;
}

export interface AdministrativePropertyCreateDraft {
  readonly nome: string;
  readonly titular: Readonly<{ produtor_id: string }>;
  readonly municipio_id: string;
  readonly status: PropertyStatus;
  readonly area_total?: string;
  readonly cultura_principal?: string;
}

export function buildCreateAdministrativePropertyPayload(draft: unknown) {
  const input = exact(draft, ['nome', 'titular', 'municipio_id', 'status', 'area_total', 'cultura_principal'],
    ['nome', 'titular', 'municipio_id', 'status']);
  // A selection carries a Produtor identity explicitly, never a Usuario projection.
  const titular = exact(input.titular, ['produtor_id'], ['produtor_id']);
  const { titular: _selection, ...fields } = input;
  return validateCreateAdministrativePropertyPayload({ ...fields, titular_id: titular.produtor_id });
}

export interface AdministrativePropertyMunicipality {
  readonly municipio_id: string;
  readonly municipio_nome: string;
  readonly uf_id: string;
  readonly uf_sigla: string;
}
export interface AdministrativePropertyEditDraft {
  readonly nome: string;
  readonly municipio: AdministrativePropertyMunicipality;
  readonly area_total: string | null;
  readonly cultura_principal: string | null;
}
export type AdministrativePropertyEditField = keyof AdministrativePropertyEditDraft;
type EditValue = AdministrativePropertyEditDraft[AdministrativePropertyEditField];
export interface AdministrativePropertyEditModel {
  readonly baseline: AdministrativePropertyProjection;
  readonly draft: AdministrativePropertyEditDraft;
  readonly dirtyFields: readonly AdministrativePropertyEditField[];
  readonly fieldConflicts: Readonly<Partial<Record<AdministrativePropertyEditField,
    Readonly<{ operatorValue: EditValue; serverValue: EditValue }>>>>;
}
const EDIT_FIELDS: readonly AdministrativePropertyEditField[] = Object.freeze([
  'nome', 'municipio', 'area_total', 'cultura_principal',
]);

function municipality(value: unknown): AdministrativePropertyMunicipality {
  const input = exact(value, ['municipio_id', 'municipio_nome', 'uf_id', 'uf_sigla'],
    ['municipio_id', 'municipio_nome', 'uf_id', 'uf_sigla']);
  const id = municipalityId(input.municipio_id);
  if (typeof input.uf_id !== 'string' || input.uf_id !== id.slice(0, 2) ||
    typeof input.uf_sigla !== 'string' || !/^[A-Z]{2}(?![\s\S])/u.test(input.uf_sigla)) return invalid('municipio');
  return Object.freeze({ municipio_id: id, municipio_nome: text(input.municipio_nome, 'municipio_nome', 200),
    uf_id: input.uf_id, uf_sigla: input.uf_sigla });
}
function values(property: AdministrativePropertyProjection): AdministrativePropertyEditDraft {
  return Object.freeze({ nome: property.nome, area_total: property.area_total_decimal,
    cultura_principal: property.cultura_principal,
    municipio: municipality({ municipio_id: property.municipio_id, municipio_nome: property.municipio_nome,
      uf_id: property.uf_id, uf_sigla: property.uf_sigla }),
  });
}
function equivalent(field: AdministrativePropertyEditField, left: EditValue, right: EditValue): boolean {
  if (field === 'municipio') return (left as AdministrativePropertyMunicipality).municipio_id ===
    (right as AdministrativePropertyMunicipality).municipio_id;
  if (left === null || right === null) return left === right;
  if (field === 'area_total') {
    try { return area(left) === area(right); } catch { return false; }
  }
  return typeof left === 'string' && typeof right === 'string' && left.normalize('NFC') === right.normalize('NFC');
}
function freezeModel(model: AdministrativePropertyEditModel): AdministrativePropertyEditModel {
  return Object.freeze({ ...model, draft: Object.freeze({ ...model.draft }),
    dirtyFields: Object.freeze([...model.dirtyFields]), fieldConflicts: Object.freeze({ ...model.fieldConflicts }) });
}
export function createAdministrativePropertyEditModel(value: AdministrativePropertyProjection): AdministrativePropertyEditModel {
  const decoded = decodeAdministrativeProperty(value);
  const baseline = Object.freeze({ ...decoded, titular: Object.freeze({ ...decoded.titular }) });
  return freezeModel({ baseline, draft: values(baseline), dirtyFields: [], fieldConflicts: {} });
}
export function updateAdministrativePropertyEditField<K extends AdministrativePropertyEditField>(
  model: AdministrativePropertyEditModel, field: K, value: AdministrativePropertyEditDraft[K],
): AdministrativePropertyEditModel {
  if (!EDIT_FIELDS.includes(field)) return invalid('campo');
  const selected = field === 'municipio' ? municipality(value) : value;
  if (field !== 'municipio' && typeof selected !== 'string' &&
    !(selected === null && (field === 'area_total' || field === 'cultura_principal'))) return invalid(field);
  const base = values(model.baseline);
  const dirty = new Set(model.dirtyFields);
  if (equivalent(field, selected, base[field])) dirty.delete(field); else dirty.add(field);
  const conflicts = { ...model.fieldConflicts };
  delete conflicts[field]; // An explicit edit resolves this field, never a background rebase.
  return freezeModel({ ...model, draft: { ...model.draft, [field]: selected },
    dirtyFields: EDIT_FIELDS.filter((key) => dirty.has(key)), fieldConflicts: conflicts });
}
export function rebaseAdministrativePropertyEditModel(
  model: AdministrativePropertyEditModel, property: AdministrativePropertyProjection,
): AdministrativePropertyEditModel {
  const next = createAdministrativePropertyEditModel(property);
  if (next.baseline.id !== model.baseline.id || next.baseline.versao < model.baseline.versao) {
    throw new InvalidBackendResponseError();
  }
  const previous = values(model.baseline);
  const draft = { ...model.draft };
  const conflicts: Partial<Record<AdministrativePropertyEditField,
    Readonly<{ operatorValue: EditValue; serverValue: EditValue }>>> = {};
  const dirty: AdministrativePropertyEditField[] = [];
  for (const field of EDIT_FIELDS) {
    const local = draft[field];
    const server = next.draft[field];
    const pending = model.fieldConflicts[field] !== undefined;
    const touched = model.dirtyFields.includes(field);
    if (pending || (touched && !equivalent(field, previous[field], server) && !equivalent(field, local, server))) {
      conflicts[field] = Object.freeze({ operatorValue: local, serverValue: server });
    } else if (!touched || equivalent(field, local, server)) {
      // Keep the municipality selection whole, including labels of the new version.
      Object.assign(draft, { [field]: server });
    }
    if (!equivalent(field, draft[field], server)) dirty.push(field);
  }
  return freezeModel({ baseline: next.baseline, draft, dirtyFields: dirty, fieldConflicts: conflicts });
}
export function resolveAdministrativePropertyEditConflict(
  model: AdministrativePropertyEditModel, field: AdministrativePropertyEditField, resolution: 'server' | 'operator',
): AdministrativePropertyEditModel {
  if (resolution !== 'server' && resolution !== 'operator') return invalid('resolucao');
  const conflict = model.fieldConflicts[field];
  if (!conflict) return model;
  return updateAdministrativePropertyEditField(model, field,
    resolution === 'server' ? conflict.serverValue : conflict.operatorValue);
}
export function buildPatchAdministrativePropertyPayload(model: AdministrativePropertyEditModel) {
  if (Object.keys(model.fieldConflicts).length > 0) return invalid('conflitos');
  const baseline = values(model.baseline);
  const payload: Record<string, unknown> = { versao: version(model.baseline.versao) };
  for (const field of EDIT_FIELDS) {
    if (!model.dirtyFields.includes(field) || equivalent(field, model.draft[field], baseline[field])) continue;
    if (field === 'municipio') payload.municipio_id = municipality(model.draft.municipio).municipio_id;
    else payload[field] = model.draft[field];
  }
  return validatePatchAdministrativePropertyPayload(payload);
}
export interface AdministrativePropertyStatusDraft {
  readonly status: PropertyStatus;
  readonly motivo: AdministrativeReasonCode;
  readonly motivo_detalhe?: string;
}
export function buildChangeAdministrativePropertyStatusPayload(
  authoritative: AdministrativePropertyProjection, draft: unknown,
) {
  uuid(authoritative.id, 'id');
  const input = exact(draft, ['status', 'motivo', 'motivo_detalhe'], ['status', 'motivo']);
  const body = validateChangeAdministrativePropertyStatusPayload({ ...input, versao: authoritative.versao });
  if (body.status === authoritative.status) return invalid('sem_transicao');
  return body;
}
