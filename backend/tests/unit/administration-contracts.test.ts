import assert from 'node:assert/strict';
import { test } from 'node:test';

import { invitationAcceptanceModeFromPersisted } from '../../src/account-actions/contracts.js';
import {
  ADMINISTRATION_LIMITS,
  ADMINISTRATIVE_AREA_TOTAL,
  ADMINISTRATIVE_COMMAND_TYPES,
  ADMINISTRATIVE_REASON_CODES,
  ADMINISTRATIVE_SENSITIVE_TERMS,
  administrativeReasonRequiresDetail,
  type InvitationActivationMode,
} from '../../src/administration/contracts.js';
import {
  ADMINISTRATIVE_AREA_PATTERN_SOURCE,
  validateAdministrativeCommandContext,
  validateAdministrativeIdempotencyReceipt,
  validateAdministrativeReason,
  validateChangeAdministrativePropertyStatusCommand,
  validateChangeAdministrativeUserStatusCommand,
  validateCreateAdministrativePropertyCommand,
  validateCreateAdministrativeUserCommand,
  validateIssueAdministrativeInvitationCommand,
  validatePropertyLinkDeltaCommand,
  normalizeAdministrativeArea,
  requireCanonicalUuid,
  validateUpdateAdministrativePropertyCommand,
  validateUpdateAdministrativeUserCommand,
} from '../../src/administration/validation.js';

const ACTOR_ID = '9c198aae-405f-4126-b590-02504fdefd68';
const SESSION_ID = 'f02a9674-723d-4a50-a67e-40c31f0bcc78';
const USER_ID = 'b604b7aa-7e51-4e73-8636-6e5518536a37';
const PROPERTY_ID = '022972b0-0ec6-4e1f-b123-d934e0f23329';
const SECOND_PROPERTY_ID = '1263ed86-9ccc-4908-a25d-0f0dd40158f5';

const context = Object.freeze({
  organizationId: 'org_tche_fertilidade',
  actorUserId: ACTOR_ID,
  sessionId: SESSION_ID,
  requestId: 'request-1',
  correlationId: 'correlation-1',
  idempotencyKey: 'idempotency-1',
  expectedVersion: 1,
});

const creationContext = Object.freeze({
  organizationId: 'org_tche_fertilidade',
  actorUserId: ACTOR_ID,
  sessionId: SESSION_ID,
  requestId: 'request-creation-1',
  correlationId: 'correlation-creation-1',
  idempotencyKey: 'idempotency-creation-1',
});

test('contratos administrativos consolidam limites aprovados na D9', () => {
  assert.deepEqual(ADMINISTRATION_LIMITS, {
    userName: 200,
    propertyName: 200,
    email: 254,
    phone: 32,
    document: 64,
    notes: 2_000,
    mainCrop: 120,
    reasonDetail: 300,
    linkIdsPerDelta: 100,
  });
});

test('catálogo D10 exige detalhe apenas para outro', () => {
  assert.deepEqual(ADMINISTRATIVE_REASON_CODES, [
    'fim_relacao',
    'mudanca_responsabilidade',
    'cadastro_duplicado',
    'correcao_administrativa',
    'suspensao_operacional',
    'outro',
  ]);
  assert.equal(administrativeReasonRequiresDetail('outro'), true);
  assert.equal(administrativeReasonRequiresDetail('fim_relacao'), false);
});

test('catálogo sensível e área numeric(14,4) possuem contrato canônico único', () => {
  assert.deepEqual(ADMINISTRATIVE_SENSITIVE_TERMS, [
    'senha', 'password', 'token', 'documento', 'cpf', 'cnpj', 'segredo',
    'credential', 'authorization', 'cookie',
  ]);
  assert.deepEqual(ADMINISTRATIVE_AREA_TOTAL, {
    maximum: '9999999999.9999', integerDigits: 10, fractionDigits: 4,
  });
  for (const term of ADMINISTRATIVE_SENSITIVE_TERMS) {
    assert.throws(
      () => validateAdministrativeReason({ code: 'outro', detail: `valor ${term} informado` }),
      /sensível não permitido/,
    );
  }
});

test('UUID administrativo canônico é v4 minúsculo com variante RFC', () => {
  assert.equal(requireCanonicalUuid(USER_ID, 'userId'), USER_ID);
  for (const value of [
    'b604b7aa-7e51-0e73-8636-6e5518536a37',
    'b604b7aa-7e51-4e73-7636-6e5518536a37',
    'B604B7AA-7E51-4E73-8636-6E5518536A37',
    'b604b7aa7e514e7386366e5518536a37',
  ]) {
    assert.throws(() => requireCanonicalUuid(value, 'userId'), /UUID canônico inválido/);
  }
});

test('área administrativa usa decimal textual exato sem passagem por Number', () => {
  assert.doesNotMatch(normalizeAdministrativeArea.toString(),
    /\b(?:Number|parseFloat|parseInt)\b/u);
  assert.doesNotMatch(ADMINISTRATIVE_AREA_PATTERN_SOURCE, /\$/u);
  for (const [value, canonical] of [
    ['0.0001', '0.0001'], ['1', '1'], ['1.0', '1'], ['1.2345', '1.2345'],
    ['1.2300', '1.23'], ['9999999999.9999', '9999999999.9999'],
  ] as const) {
    assert.equal(normalizeAdministrativeArea(value, 'areaTotal'), canonical);
  }
  for (const value of [1, 0, -1, Number.NaN, Number.POSITIVE_INFINITY,
    '0', '-1', '0.00001', '1.00000000000000001', '9999999999.99999',
    '10000000000', '01.25', ' 1.25 ', ' 1', '1 ', '1\t', '0\n', '1\n',
    '1.0\n', '1\r', '1\r\n', '1\u2028', '1\u2029', 'NaN', 'Infinity', '1e-4',
    '.25', '1.', true, [], {}, null]) {
    assert.throws(() => normalizeAdministrativeArea(value, 'areaTotal'), /área|numeric|decimal/);
  }
});

test('catálogo de comandos cobre somente a administração prevista na MP-35', () => {
  assert.deepEqual(ADMINISTRATIVE_COMMAND_TYPES, [
    'usuario.criar',
    'usuario.atualizar',
    'usuario.alterar_status',
    'usuario.alterar_vinculos',
    'usuario.emitir_convite',
    'propriedade.criar',
    'propriedade.atualizar',
    'propriedade.alterar_status',
  ]);
});

test('modo persistido de convite possui uma única conversão canônica e falha fechado', () => {
  const modes: readonly InvitationActivationMode[] = [
    'manter_status',
    'ativar_usuario',
    'ativar_admin_bootstrap',
  ];
  assert.deepEqual(
    modes.map(invitationAcceptanceModeFromPersisted),
    ['keep_status', 'activate_user', 'activate_bootstrap_admin'],
  );
  assert.throws(
    () => invitationAcceptanceModeFromPersisted('modo_desconhecido'),
    /unknown persisted invitation activation mode/i,
  );
});

test('motivo e contexto rejeitam campos desconhecidos e material sensível', () => {
  assert.throws(
    () => validateAdministrativeReason({ code: 'outro' }),
    /obrigatório para o motivo outro/,
  );
  assert.throws(
    () =>
      validateAdministrativeReason({
        code: 'outro',
        detail: 'ajuste manual',
        password: 'segredo',
      }),
    /campo não permitido/,
  );
  assert.throws(
    () =>
      validateAdministrativeCommandContext({
        ...context,
        password: 'segredo',
      }),
    /campo não permitido/,
  );
  assert.doesNotThrow(() =>
    validateAdministrativeReason({ code: 'outro', detail: 'ajuste manual' }),
  );
  assert.doesNotThrow(() =>
    validateAdministrativeReason({ code: 'fim_relacao' }),
  );
  for (const sensitive of ['senha temporária', 'TOKEN copiado', 'CPF informado']) {
    assert.throws(
      () => validateAdministrativeReason({ code: 'outro', detail: sensitive }),
      /sensível não permitido/,
    );
  }
});

test('limites D9 contam pontos de código após normalização NFC', () => {
  const validateName = (name: string) => validateCreateAdministrativeUserCommand({
    context: creationContext,
    name,
    email: 'unicode@example.test',
    profile: 'colaborador',
  });
  for (const name of [
    'a'.repeat(200),
    '😀'.repeat(200),
    'é'.repeat(200),
    'é'.repeat(200),
  ]) {
    assert.doesNotThrow(() => validateName(name));
  }
  for (const name of [
    'a'.repeat(201),
    '😀'.repeat(201),
    'é'.repeat(201),
    'é'.repeat(201),
  ]) {
    assert.throws(() => validateName(name), /texto preenchido inválido/);
  }
});

test('limite de e-mail conta N/N+1 pontos de código após NFC', () => {
  const suffix = '@x.io';
  for (const [label, unit] of [
    ['ascii', 'a'],
    ['emoji', '😀'],
    ['composto', 'é'],
    ['decomposto', 'é'],
    ['fora-bmp', '𐐷'],
  ] as const) {
    const atLimit = `${unit.repeat(254 - suffix.length)}${suffix}`;
    const aboveLimit = `${unit.repeat(255 - suffix.length)}${suffix}`;
    assert.equal(Array.from(atLimit.normalize('NFC')).length, 254, label);
    assert.equal(Array.from(aboveLimit.normalize('NFC')).length, 255, label);
    assert.doesNotThrow(() => validateCreateAdministrativeUserCommand({
      context: creationContext,
      name: `E-mail ${label}`,
      email: atLimit,
      profile: 'colaborador',
    }));
    assert.throws(() => validateCreateAdministrativeUserCommand({
      context: creationContext,
      name: `E-mail ${label}`,
      email: aboveLimit,
      profile: 'colaborador',
    }), /texto preenchido inválido/);
  }
});

test('validadores de Usuário rejeitam campos desconhecidos, IDs inválidos e no-op', () => {
  assert.doesNotThrow(() =>
    validateCreateAdministrativeUserCommand({
      context: creationContext,
      name: 'Pessoa convidada',
      email: 'pessoa@example.test',
      profile: 'colaborador',
    }),
  );
  assert.throws(
    () =>
      validateCreateAdministrativeUserCommand({
        context: creationContext,
        name: 'Pessoa convidada',
        email: 'pessoa@example.test',
        profile: 'colaborador',
        password: 'segredo',
      }),
    /campo não permitido/,
  );
  assert.throws(
    () => validateUpdateAdministrativeUserCommand({ context, userId: USER_ID }),
    /sem efeito/,
  );
  assert.throws(
    () =>
      validateUpdateAdministrativeUserCommand({
        context,
        userId: '',
        name: 'Nome válido',
      }),
    /UUID canônico inválido/,
  );
  assert.doesNotThrow(() =>
    validateUpdateAdministrativeUserCommand({
      context,
      userId: USER_ID,
      notes: null,
    }),
  );
  assert.doesNotThrow(() =>
    validateChangeAdministrativeUserStatusCommand({
      context,
      userId: USER_ID,
      status: 'inativo',
      reason: { code: 'fim_relacao' },
    }),
  );
});

test('convite novo aceita somente ativar_usuario e nenhum modo desconhecido', () => {
  assert.doesNotThrow(() =>
    validateIssueAdministrativeInvitationCommand({
      context: creationContext,
      userId: USER_ID,
      activationMode: 'ativar_usuario',
    }),
  );
  for (const activationMode of ['manter_status', 'modo_desconhecido']) {
    assert.throws(
      () =>
        validateIssueAdministrativeInvitationCommand({
          context: creationContext,
          userId: USER_ID,
          activationMode,
        }),
      /novos convites usam ativar_usuario/,
    );
  }
});

test('delta rejeita vazio, IDs inválidos, esparsidade, campos desconhecidos e duplicidade', () => {
  assert.throws(
    () =>
      validatePropertyLinkDeltaCommand({
        context,
        userId: USER_ID,
        add: [],
        remove: [],
      }),
    /delta vazio/,
  );
  const link = { propertyId: PROPERTY_ID };
  assert.throws(
    () =>
      validatePropertyLinkDeltaCommand({
        context,
        userId: USER_ID,
        add: [{ ...link, password: 'segredo' }],
        remove: [],
      }),
    /campo não permitido/,
  );
  const sparse = new Array(1) as unknown[];
  assert.throws(
    () =>
      validatePropertyLinkDeltaCommand({
        context,
        userId: USER_ID,
        add: sparse,
        remove: [],
      }),
    /lista esparsa/,
  );
  assert.throws(
    () =>
      validatePropertyLinkDeltaCommand({
        context,
        userId: USER_ID,
        add: [link, link],
        remove: [],
      }),
    /duplicada/,
  );
  assert.throws(
    () =>
      validatePropertyLinkDeltaCommand({
        context,
        userId: USER_ID,
        add: [link],
        remove: [link],
        reason: { code: 'correcao_administrativa' },
      }),
    /add e remove/,
  );
  assert.throws(
    () =>
      validatePropertyLinkDeltaCommand({
        context,
        userId: USER_ID,
        add: [{ propertyId: '' }],
        remove: [],
      }),
    /UUID canônico inválido/,
  );
  assert.throws(
    () =>
      validatePropertyLinkDeltaCommand({
        context,
        userId: USER_ID,
        add: Array.from({ length: 101 }, (_, index) => ({
          propertyId:
            index === 0
              ? PROPERTY_ID
              : `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
        })),
        remove: [],
      }),
    /limite de vínculos/,
  );
  assert.doesNotThrow(() =>
    validatePropertyLinkDeltaCommand({
      context,
      userId: USER_ID,
      add: [link],
      remove: [{ propertyId: SECOND_PROPERTY_ID }],
      reason: { code: 'mudanca_responsabilidade' },
    }),
  );
});

test('D8 aceita somente municipioId externo e holderId somente na criação', () => {
  assert.doesNotThrow(() =>
    validateCreateAdministrativePropertyCommand({
      context: creationContext,
      name: 'Propriedade D8',
      holderId: USER_ID,
      municipalityId: '4314902',
      status: 'ativa',
    }),
  );
  assert.throws(
    () =>
      validateCreateAdministrativePropertyCommand({
        context: creationContext,
        name: 'Propriedade D8',
        holderId: USER_ID,
        municipalityId: '4314902',
        stateId: '43',
        status: 'ativa',
      }),
    /campo não permitido/,
  );
  assert.doesNotThrow(() =>
    validateUpdateAdministrativePropertyCommand({
      context,
      propertyId: PROPERTY_ID,
      municipalityId: '4305108',
    }),
  );
  for (const partialOrForbidden of [
    { stateId: '43' },
    { ufId: '43' },
    { holderId: USER_ID },
  ]) {
    assert.throws(
      () =>
        validateUpdateAdministrativePropertyCommand({
          context,
          propertyId: PROPERTY_ID,
          ...partialOrForbidden,
        }),
      /campo não permitido/,
    );
  }
  assert.throws(
    () =>
      validateUpdateAdministrativePropertyCommand({
        context,
        propertyId: PROPERTY_ID,
      }),
    /sem efeito/,
  );
  assert.doesNotThrow(() =>
    validateChangeAdministrativePropertyStatusCommand({
      context,
      propertyId: PROPERTY_ID,
      status: 'inativa',
      reason: { code: 'suspensao_operacional' },
    }),
  );
});

test('recibo idempotente exige status, recurso, versão e campos coerentes', () => {
  const createdAt = new Date('2026-08-25T12:00:00.000Z');
  const expiresAt = new Date(createdAt.getTime() + 90 * 24 * 60 * 60_000);
  const valid = {
    command: 'usuario.criar',
    state: 'concluido',
    sessionId: SESSION_ID,
    requestId: 'request-1',
    correlationId: 'correlation-1',
    httpStatus: 201,
    receipt: {
      outcome: 'criado',
      resourceType: 'usuario',
      resourceId: USER_ID,
      version: 1,
    },
    createdAt,
    expiresAt,
  };
  assert.doesNotThrow(() => validateAdministrativeIdempotencyReceipt(valid));
  assert.throws(
    () =>
      validateAdministrativeIdempotencyReceipt({
        ...valid,
        httpStatus: 200,
      }),
    /status incoerente/,
  );
  assert.throws(
    () =>
      validateAdministrativeIdempotencyReceipt({
        ...valid,
        receipt: { ...valid.receipt, version: undefined },
      }),
    /versão positiva obrigatória/,
  );
  assert.throws(
    () =>
      validateAdministrativeIdempotencyReceipt({
        ...valid,
        receipt: { ...valid.receipt, password: 'segredo' },
      }),
    /campo não permitido/,
  );
  assert.throws(
    () =>
      validateAdministrativeIdempotencyReceipt({
        ...valid,
        command: 'usuario.emitir_convite',
        receipt: {
          outcome: 'convite_emitido',
          resourceType: 'convite',
          resourceId: USER_ID,
          version: 1,
        },
      }),
    /version.*não permitida|não permitida para convite/,
  );
  assert.throws(
    () =>
      validateAdministrativeIdempotencyReceipt({
        command: 'usuario.criar',
        state: 'processando',
        sessionId: SESSION_ID,
        requestId: 'request-1',
        correlationId: 'correlation-1',
        httpStatus: 201,
        receipt: {},
        createdAt,
        expiresAt,
      }),
    /processamento não possui recibo/,
  );
});
