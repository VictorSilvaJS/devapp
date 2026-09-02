import { ApiResponseError } from './backendApi';
import type { SessionSnapshot } from './contracts';
import { InvalidBackendResponseError } from './decoders';
import { ApiTransportError } from './httpTransport';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_CANONICAL_BODY_BYTES = 64 * 1_024;
const MAX_BODY_DEPTH = 32;
const MAX_JSON_NODES = 4_096;
const MAX_JSON_OBJECT_PROPERTIES = 512;
const MAX_JSON_ARRAY_ELEMENTS = 1_024;
const MAX_JSON_STRING_CODE_UNITS = 65_536;
const MAX_JSON_KEY_CODE_UNITS = 1_024;

export type AdministrativeMutationMethod = 'POST' | 'PATCH' | 'DELETE';

export type AdministrativeJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AdministrativeJsonValue[]
  | AdministrativeJsonObject;

export interface AdministrativeJsonObject {
  readonly [key: string]: AdministrativeJsonValue;
}

export interface AdministrativeCommandExecution {
  readonly idempotencyKey: string;
  readonly method: AdministrativeMutationMethod;
  readonly route: string;
  readonly body: AdministrativeJsonObject;
}

export interface AdministrativeSessionExecutor {
  authenticated<T>(
    operation: (accessToken: string) => Promise<T>,
  ): Promise<T>;
}

export type AdministrativeCommandDisposition =
  | 'ambiguous'
  | 'definitive'
  | 'version_conflict';

export class InvalidAdministrativeCommandError extends Error {
  constructor() {
    super('A intenção administrativa é inválida.');
    this.name = 'InvalidAdministrativeCommandError';
  }
}

export class AdministrativeCommandInFlightError extends Error {
  constructor() {
    super('Esta intenção administrativa já está em andamento.');
    this.name = 'AdministrativeCommandInFlightError';
  }
}

export class AdministrativeCommandChangedError extends Error {
  constructor() {
    super('O comando mudou e exige uma nova intenção idempotente.');
    this.name = 'AdministrativeCommandChangedError';
  }
}

export class AdministrativeCommandPartitionChangedError extends Error {
  constructor() {
    super('A identidade da sessão mudou durante o comando.');
    this.name = 'AdministrativeCommandPartitionChangedError';
  }
}

interface CanonicalValue {
  readonly value: AdministrativeJsonValue;
}

interface CanonicalizationContext {
  readonly stack: WeakSet<object>;
  readonly writer: JsonCanonicalWriter;
  nodes: number;
}

interface AdministrativeCommandEntry {
  readonly token: object;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly method: AdministrativeMutationMethod;
  readonly route: string;
  readonly canonicalBody: string;
  readonly descriptor: string;
  readonly generation: number;
  readonly partition: string | null;
  state: 'in_flight' | 'ambiguous';
}

interface CapturedAdministrativeCommandInput {
  readonly intentId: string;
  readonly method: AdministrativeMutationMethod;
  readonly route: string;
  readonly body: Readonly<Record<string, unknown>>;
}

type ExpoUuidGlobal = typeof globalThis & {
  readonly expo?: Readonly<{ uuidv4?: () => string }>;
};

function secureUuidV4(): string {
  const createUuid = (globalThis as ExpoUuidGlobal).expo?.uuidv4;
  if (createUuid === undefined) {
    throw new InvalidAdministrativeCommandError();
  }
  return createUuid();
}

function opaqueUuid(
  prefix: 'admin' | 'intent',
  createUuid: () => string,
): string {
  const uuid = createUuid();
  if (!UUID_V4_PATTERN.test(uuid)) {
    throw new InvalidAdministrativeCommandError();
  }
  const opaque = `${prefix}_${uuid.replaceAll('-', '')}`;
  if (!OPAQUE_ID_PATTERN.test(opaque)) {
    throw new InvalidAdministrativeCommandError();
  }
  return opaque;
}

export function createAdministrativeIdempotencyKey(
  createUuid: () => string = secureUuidV4,
): string {
  return opaqueUuid('admin', createUuid);
}

export function createAdministrativeIntentId(
  createUuid: () => string = secureUuidV4,
): string {
  return opaqueUuid('intent', createUuid);
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: unknown } {
  return descriptor !== undefined &&
    Object.hasOwn(descriptor, 'value') &&
    descriptor.get === undefined &&
    descriptor.set === undefined;
}

class JsonCanonicalWriter {
  readonly #segments: string[] = [];
  #bytes = 0;

  get remaining(): number {
    return MAX_CANONICAL_BODY_BYTES - this.#bytes;
  }

  reserve(bytes: number): void {
    if (
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      bytes > this.remaining
    ) {
      throw new InvalidAdministrativeCommandError();
    }
    this.#bytes += bytes;
  }

  pushReserved(segment: string): void {
    this.#segments.push(segment);
  }

  appendAscii(segment: string): void {
    this.reserve(segment.length);
    this.pushReserved(segment);
  }

  finish(): string {
    return this.#segments.join('');
  }
}

function utf8BytesForCodeUnit(value: string, index: number): Readonly<{
  bytes: number;
  consumedCodeUnits: number;
}> {
  const code = value.charCodeAt(index);
  if (code <= 0x7f) return { bytes: 1, consumedCodeUnits: 1 };
  if (code <= 0x7ff) return { bytes: 2, consumedCodeUnits: 1 };
  if (code >= 0xd800 && code <= 0xdbff) {
    const next = value.charCodeAt(index + 1);
    if (next >= 0xdc00 && next <= 0xdfff) {
      return { bytes: 4, consumedCodeUnits: 2 };
    }
    return { bytes: 6, consumedCodeUnits: 1 };
  }
  if (code >= 0xdc00 && code <= 0xdfff) {
    return { bytes: 6, consumedCodeUnits: 1 };
  }
  return { bytes: 3, consumedCodeUnits: 1 };
}

function escapedCodeUnit(code: number): string | null {
  if (code === 0x22) return '\\"';
  if (code === 0x5c) return '\\\\';
  if (code === 0x08) return '\\b';
  if (code === 0x09) return '\\t';
  if (code === 0x0a) return '\\n';
  if (code === 0x0c) return '\\f';
  if (code === 0x0d) return '\\r';
  if (code < 0x20 || (code >= 0xd800 && code <= 0xdfff)) {
    return `\\u${code.toString(16).padStart(4, '0')}`;
  }
  return null;
}

function appendJsonString(
  value: string,
  writer: JsonCanonicalWriter,
  maxCodeUnits: number,
): void {
  // Cada unidade UTF-16 exige pelo menos um byte no JSON, além das aspas.
  // Esta guarda rejeita entradas enormes antes de percorrer ou escapar a string.
  if (value.length + 2 > writer.remaining || value.length > maxCodeUnits) {
    throw new InvalidAdministrativeCommandError();
  }
  writer.appendAscii('"');
  let rawStart = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const encoded = utf8BytesForCodeUnit(value, index);
    if (encoded.consumedCodeUnits === 2) {
      writer.reserve(encoded.bytes);
      index += 1;
      continue;
    }
    const escaped = escapedCodeUnit(code);
    if (escaped !== null) {
      if (rawStart < index) {
        writer.pushReserved(value.slice(rawStart, index));
      }
      writer.reserve(escaped.length);
      writer.pushReserved(escaped);
      rawStart = index + 1;
      continue;
    }
    writer.reserve(encoded.bytes);
  }
  if (rawStart < value.length) {
    writer.pushReserved(value.slice(rawStart));
  }
  writer.appendAscii('"');
}

function consumeNode(context: CanonicalizationContext): void {
  context.nodes += 1;
  if (context.nodes > MAX_JSON_NODES) {
    throw new InvalidAdministrativeCommandError();
  }
}

function canonicalizeArray(
  value: object,
  context: CanonicalizationContext,
  depth: number,
): CanonicalValue {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new InvalidAdministrativeCommandError();
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    !isDataDescriptor(lengthDescriptor) ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.enumerable !== false ||
    lengthDescriptor.configurable !== false
  ) {
    throw new InvalidAdministrativeCommandError();
  }
  const length = lengthDescriptor.value;
  const minimumBytes = length === 0 ? 2 : (2 * length) + 1;
  if (
    length > MAX_JSON_ARRAY_ELEMENTS ||
    context.nodes + length > MAX_JSON_NODES ||
    minimumBytes > context.writer.remaining
  ) {
    throw new InvalidAdministrativeCommandError();
  }

  // O length e os orçamentos mínimos passam antes da enumeração potencialmente cara.
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1) {
    throw new InvalidAdministrativeCommandError();
  }
  const values: unknown[] = new Array(length);
  const seen: boolean[] = new Array(length).fill(false);
  for (const key of ownKeys) {
    if (key === 'length') continue;
    if (typeof key !== 'string') throw new InvalidAdministrativeCommandError();
    const index = Number(key);
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= length ||
      String(index) !== key ||
      seen[index]
    ) {
      throw new InvalidAdministrativeCommandError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
      throw new InvalidAdministrativeCommandError();
    }
    seen[index] = true;
    values[index] = descriptor.value;
  }
  if (seen.some((present) => !present)) {
    throw new InvalidAdministrativeCommandError();
  }

  const items: AdministrativeJsonValue[] = [];
  context.stack.add(value);
  context.writer.appendAscii('[');
  context.writer.reserve(1);
  try {
    for (let index = 0; index < length; index += 1) {
      if (index > 0) context.writer.appendAscii(',');
      const item = canonicalizeJsonValue(values[index], context, depth + 1);
      items.push(item.value);
    }
    context.writer.pushReserved(']');
  } finally {
    context.stack.delete(value);
  }
  return { value: Object.freeze(items) };
}

function canonicalizeObject(
  value: object,
  context: CanonicalizationContext,
  depth: number,
): CanonicalValue {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new InvalidAdministrativeCommandError();
  }
  const ownKeys = Reflect.ownKeys(value);
  const propertyCount = ownKeys.length;
  const minimumBytes = propertyCount === 0 ? 2 : (5 * propertyCount) + 1;
  if (
    propertyCount > MAX_JSON_OBJECT_PROPERTIES ||
    context.nodes + propertyCount > MAX_JSON_NODES ||
    minimumBytes > context.writer.remaining
  ) {
    throw new InvalidAdministrativeCommandError();
  }

  const entries: Array<Readonly<{ key: string; value: unknown }>> = [];
  for (const key of ownKeys) {
    if (
      typeof key !== 'string' ||
      key === '__proto__' ||
      key === 'prototype' ||
      key === 'constructor' ||
      key.length > MAX_JSON_KEY_CODE_UNITS
    ) {
      throw new InvalidAdministrativeCommandError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!isDataDescriptor(descriptor) || descriptor.enumerable !== true) {
      throw new InvalidAdministrativeCommandError();
    }
    entries.push({ key, value: descriptor.value });
  }
  entries.sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);

  const result: Record<string, AdministrativeJsonValue> = {};
  context.stack.add(value);
  context.writer.appendAscii('{');
  context.writer.reserve(1);
  try {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (index > 0) context.writer.appendAscii(',');
      appendJsonString(entry.key, context.writer, MAX_JSON_KEY_CODE_UNITS);
      context.writer.appendAscii(':');
      const item = canonicalizeJsonValue(entry.value, context, depth + 1);
      result[entry.key] = item.value;
    }
    context.writer.pushReserved('}');
  } finally {
    context.stack.delete(value);
  }
  return { value: Object.freeze(result) };
}

function canonicalizeJsonValue(
  value: unknown,
  context: CanonicalizationContext,
  depth: number,
): CanonicalValue {
  if (depth > MAX_BODY_DEPTH) throw new InvalidAdministrativeCommandError();
  consumeNode(context);
  if (value === null) {
    context.writer.appendAscii('null');
    return { value: null };
  }
  if (typeof value === 'string') {
    appendJsonString(value, context.writer, MAX_JSON_STRING_CODE_UNITS);
    return { value };
  }
  if (typeof value === 'boolean') {
    context.writer.appendAscii(value ? 'true' : 'false');
    return { value };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new InvalidAdministrativeCommandError();
    const normalized = Object.is(value, -0) ? 0 : value;
    context.writer.appendAscii(String(normalized));
    return { value: normalized };
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    context.stack.has(value)
  ) {
    throw new InvalidAdministrativeCommandError();
  }
  return Array.isArray(value)
    ? canonicalizeArray(value, context, depth)
    : canonicalizeObject(value, context, depth);
}

function canonicalBody(value: unknown): Readonly<{
  serialized: string;
  body: AdministrativeJsonObject;
}> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidAdministrativeCommandError();
  }
  const writer = new JsonCanonicalWriter();
  const canonical = canonicalizeJsonValue(value, {
    stack: new WeakSet(),
    writer,
    nodes: 0,
  }, 0);
  if (!isAdministrativeJsonObject(canonical.value)) {
    throw new InvalidAdministrativeCommandError();
  }
  return {
    serialized: writer.finish(),
    body: canonical.value,
  };
}

function isAdministrativeJsonObject(
  value: AdministrativeJsonValue,
): value is AdministrativeJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validRoute(route: string): boolean {
  return route.startsWith('/v1/') &&
    route.length <= 2_048 &&
    !route.includes('?') &&
    !route.includes('#') &&
    !/[\u0000-\u0020\u007f]/.test(route);
}

function captureAdministrativeCommandInput(
  input: Readonly<{
    intentId: string;
    method: AdministrativeMutationMethod;
    route: string;
    body: Readonly<Record<string, unknown>>;
  }>,
): CapturedAdministrativeCommandInput {
  const intentId = input.intentId;
  const method = input.method;
  const route = input.route;
  const body = input.body;
  return { intentId, method, route, body };
}

export function administrativeCommandDispositionForError(
  error: unknown,
): AdministrativeCommandDisposition {
  if (
    error instanceof ApiTransportError ||
    error instanceof InvalidBackendResponseError
  ) {
    return 'ambiguous';
  }
  if (error instanceof ApiResponseError) {
    if (error.code === 'version_conflict') return 'version_conflict';
    if (error.status === 429 || error.status >= 500) return 'ambiguous';
  }
  return 'definitive';
}

export class AdministrativeCommandCoordinator {
  readonly #entries = new Map<string, AdministrativeCommandEntry>();
  readonly #session: AdministrativeSessionExecutor;
  readonly #createKey: () => string;
  #partition: string | null = null;
  #generation = 0;

  constructor(input: Readonly<{
    session: AdministrativeSessionExecutor;
    createKey?: () => string;
  }>) {
    this.#session = input.session;
    this.#createKey = input.createKey ?? createAdministrativeIdempotencyKey;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(intentId: string): boolean {
    return this.#entries.has(intentId);
  }

  synchronizeSession(
    snapshot: SessionSnapshot | null,
    sessionEpoch: number,
  ): boolean {
    const next = snapshot === null
      ? `anonymous:${sessionEpoch}`
      : [
          snapshot.usuario.organizacao_id,
          snapshot.usuario.id,
          snapshot.id,
          snapshot.usuario.perfil,
          snapshot.usuario.status,
          snapshot.usuario.versao_autorizacao,
          snapshot.escopo.modo,
          snapshot.escopo.versao,
          sessionEpoch,
        ].join(':');
    if (this.#partition === next) return false;
    this.#partition = next;
    this.clear();
    return true;
  }

  clear(): void {
    this.#generation += 1;
    this.#entries.clear();
  }

  invalidateIntent(intentId: string): boolean {
    return this.#entries.delete(intentId);
  }

  async execute<T>(
    input: Readonly<{
      intentId: string;
      method: AdministrativeMutationMethod;
      route: string;
      body: Readonly<Record<string, unknown>>;
    }>,
    operation: (
      accessToken: string,
      command: AdministrativeCommandExecution,
    ) => Promise<T>,
  ): Promise<T> {
    const captured = captureAdministrativeCommandInput(input);
    const entry = this.#begin(captured);
    try {
      const result = await this.#session.authenticated((accessToken) => {
        const snapshot = this.#snapshot(entry);
        return operation(accessToken, snapshot);
      });
      if (!this.#isCurrentEntry(entry)) {
        throw new AdministrativeCommandPartitionChangedError();
      }
      this.#settle(entry, 'definitive');
      return result;
    } catch (error) {
      if (this.#isCurrentEntry(entry)) {
        this.#settle(entry, administrativeCommandDispositionForError(error));
      }
      throw error;
    }
  }

  #begin(input: CapturedAdministrativeCommandInput): AdministrativeCommandEntry {
    if (
      !OPAQUE_ID_PATTERN.test(input.intentId) ||
      !['POST', 'PATCH', 'DELETE'].includes(input.method) ||
      !validRoute(input.route)
    ) {
      throw new InvalidAdministrativeCommandError();
    }
    const canonical = canonicalBody(input.body);
    const descriptor = [
      input.method,
      input.route,
      canonical.serialized,
    ].join('\n');
    const existing = this.#entries.get(input.intentId);
    if (existing !== undefined) {
      if (existing.descriptor !== descriptor) {
        if (existing.state === 'ambiguous') this.#entries.delete(input.intentId);
        throw new AdministrativeCommandChangedError();
      }
      if (existing.state === 'in_flight') {
        throw new AdministrativeCommandInFlightError();
      }
      existing.state = 'in_flight';
      return existing;
    }
    const idempotencyKey = this.#createKey();
    if (!OPAQUE_ID_PATTERN.test(idempotencyKey)) {
      throw new InvalidAdministrativeCommandError();
    }
    const created: AdministrativeCommandEntry = {
      token: Object.freeze({}),
      intentId: input.intentId,
      idempotencyKey,
      method: input.method,
      route: input.route,
      canonicalBody: canonical.serialized,
      descriptor,
      generation: this.#generation,
      partition: this.#partition,
      state: 'in_flight',
    };
    this.#entries.set(input.intentId, created);
    return created;
  }

  #isCurrentEntry(entry: AdministrativeCommandEntry): boolean {
    const current = this.#entries.get(entry.intentId);
    return current === entry &&
      current.token === entry.token &&
      current.generation === entry.generation &&
      entry.generation === this.#generation &&
      entry.partition === this.#partition;
  }

  #snapshot(entry: AdministrativeCommandEntry): AdministrativeCommandExecution {
    if (
      !this.#isCurrentEntry(entry) ||
      entry.state !== 'in_flight'
    ) {
      throw new AdministrativeCommandPartitionChangedError();
    }
    const canonical = canonicalBody(JSON.parse(entry.canonicalBody));
    if (canonical.serialized !== entry.canonicalBody) {
      throw new InvalidAdministrativeCommandError();
    }
    return Object.freeze({
      idempotencyKey: entry.idempotencyKey,
      method: entry.method,
      route: entry.route,
      body: canonical.body,
    });
  }

  #settle(
    entry: AdministrativeCommandEntry,
    disposition: AdministrativeCommandDisposition,
  ): void {
    if (!this.#isCurrentEntry(entry)) return;
    if (disposition === 'ambiguous') {
      entry.state = 'ambiguous';
      return;
    }
    this.#entries.delete(entry.intentId);
  }
}
