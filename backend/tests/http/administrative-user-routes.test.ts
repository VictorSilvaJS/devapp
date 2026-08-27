import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import fastify from 'fastify';

import { administrativeUserRoutesPlugin } from '../../src/administration/user-routes.js';
import type {
  AdministrativeMutationResponse,
  AdministrativeUserService,
} from '../../src/administration/user-service.js';
import type { AdministrativeUserView } from '../../src/administration/user-contracts.js';
import { conflict, unprocessableEntity } from '../../src/security/http-error.js';

const USER_ID = '30000000-0000-4000-8000-000000000001';
const PRODUCER_ID = '40000000-0000-4000-8000-000000000001';
const AUTHORIZATION = `Bearer ${'A'.repeat(43)}`;

function user(): AdministrativeUserView {
  return {
    id: USER_ID,
    organizationId: 'org_tche_fertilidade',
    producerId: PRODUCER_ID,
    name: 'Produtora Ágata',
    sortKey: 'produtora ágata',
    email: 'agata@example.test',
    profile: 'produtor',
    status: 'pendente',
    phone: null,
    document: 'DOC-1',
    notes: null,
    version: 2,
    createdAt: new Date('2026-08-26T10:00:00.000Z'),
    updatedAt: new Date('2026-08-26T11:00:00.000Z'),
  };
}

interface Calls {
  list?: unknown;
  detail?: unknown;
  create?: unknown;
  update?: unknown;
  status?: unknown;
  invitation?: unknown;
}

function harness() {
  const calls: Calls = {};
  let mutationError: Error | undefined;
  const versioned: AdministrativeMutationResponse = {
    httpStatus: 200,
    receipt: {
      outcome: 'atualizado',
      resourceType: 'usuario',
      resourceId: USER_ID,
      version: 3,
    },
  };
  const service: AdministrativeUserService = {
    async list(input) {
      calls.list = input;
      return { items: [user()], nextCursor: 'next-cursor' };
    },
    async detail(input) {
      calls.detail = input;
      return user();
    },
    async create(input) {
      calls.create = input;
      if (mutationError !== undefined) throw mutationError;
      return {
        httpStatus: 201,
        receipt: {
          outcome: 'criado',
          resourceType: 'usuario',
          resourceId: USER_ID,
          version: 1,
        },
      };
    },
    async update(input) {
      calls.update = input;
      if (mutationError !== undefined) throw mutationError;
      return versioned;
    },
    async changeStatus(input) {
      calls.status = input;
      if (mutationError !== undefined) throw mutationError;
      return {
        httpStatus: 200,
        receipt: {
          outcome: 'status_alterado',
          resourceType: 'usuario',
          resourceId: USER_ID,
          version: 3,
        },
      };
    },
    async issueInvitation(input) {
      calls.invitation = input;
      if (mutationError !== undefined) throw mutationError;
      return {
        httpStatus: 201,
        receipt: {
          outcome: 'convite_emitido',
          resourceType: 'convite',
          resourceId: '50000000-0000-4000-8000-000000000001',
        },
      };
    },
  };
  return {
    calls,
    service,
    setMutationError(error: Error | undefined) {
      mutationError = error;
    },
  };
}

async function buildTestApp(service: AdministrativeUserService) {
  const app = fastify({
    logger: false,
    genReqId: () => 'req-admin-users',
  });
  await app.register(administrativeUserRoutesPlugin, {
    prefix: '/v1/usuarios',
    service,
  });
  return app;
}

describe('administrative user HTTP plugin', () => {
  it('publica lista e detalhe em snake_case sem credencial ou token', async () => {
    const target = harness();
    const app = await buildTestApp(target.service);
    try {
      const list = await app.inject({
        method: 'GET',
        url: '/v1/usuarios?perfil=produtor&limite=20',
        headers: { authorization: AUTHORIZATION },
      });
      assert.equal(list.statusCode, 200);
      assert.equal(list.headers['cache-control'], 'no-store');
      assert.deepEqual(list.json(), {
        itens: [
          {
            id: USER_ID,
            organizacao_id: 'org_tche_fertilidade',
            produtor_id: PRODUCER_ID,
            nome: 'Produtora Ágata',
            email: 'agata@example.test',
            perfil: 'produtor',
            status: 'pendente',
            telefone: null,
            documento: 'DOC-1',
            observacoes: null,
            versao: 2,
            criado_em: '2026-08-26T10:00:00.000Z',
            atualizado_em: '2026-08-26T11:00:00.000Z',
          },
        ],
        paginacao: { proximo_cursor: 'next-cursor' },
      });
      assert.equal(list.payload.includes('token'), false);
      assert.equal(list.payload.includes('senha'), false);
      const capturedList = target.calls.list as {
        authorization: string;
        query: { perfil: string; limite: number };
      };
      assert.equal(capturedList.authorization, AUTHORIZATION);
      assert.deepEqual({ ...capturedList.query }, {
        perfil: 'produtor',
        limite: 20,
      });

      const detail = await app.inject({
        method: 'GET',
        url: `/v1/usuarios/${USER_ID}`,
        headers: { authorization: AUTHORIZATION },
      });
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.json().produtor_id, PRODUCER_ID);
      assert.deepEqual(target.calls.detail, {
        authorization: AUTHORIZATION,
        userId: USER_ID,
      });
    } finally {
      await app.close();
    }
  });

  it('encaminha criação e responde somente com recibo seguro', async () => {
    const target = harness();
    const app = await buildTestApp(target.service);
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: {
          authorization: AUTHORIZATION,
          'idempotency-key': 'create-user-1',
        },
        payload: {
          nome: 'Produtora Ágata',
          email: 'agata@example.test',
          perfil: 'produtor',
        },
      });
      assert.equal(response.statusCode, 201);
      assert.deepEqual(response.json(), {
        resultado: 'criado',
        recurso_tipo: 'usuario',
        recurso_id: USER_ID,
        versao: 1,
      });
      assert.equal(response.payload.includes('email'), false);
      assert.deepEqual(target.calls.create, {
        authorization: AUTHORIZATION,
        idempotencyKey: 'create-user-1',
        requestId: 'req-admin-users',
        body: {
          nome: 'Produtora Ágata',
          email: 'agata@example.test',
          perfil: 'produtor',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('encaminha edição, status e convite com versão/motivo/modo explícitos', async () => {
    const target = harness();
    const app = await buildTestApp(target.service);
    const headers = {
      authorization: AUTHORIZATION,
      'idempotency-key': 'mutation-1',
    };
    try {
      const update = await app.inject({
        method: 'PATCH',
        url: `/v1/usuarios/${USER_ID}`,
        headers,
        payload: { versao: 2, telefone: null },
      });
      assert.equal(update.statusCode, 200);
      assert.equal(update.json().resultado, 'atualizado');

      const status = await app.inject({
        method: 'PATCH',
        url: `/v1/usuarios/${USER_ID}/status`,
        headers: { ...headers, 'idempotency-key': 'status-1' },
        payload: {
          versao: 2,
          status: 'inativo',
          motivo: 'outro',
          motivo_detalhe: 'Encerramento validado',
        },
      });
      assert.equal(status.statusCode, 200);
      assert.equal(status.json().resultado, 'status_alterado');

      const invitation = await app.inject({
        method: 'POST',
        url: `/v1/usuarios/${USER_ID}/convites`,
        headers: { ...headers, 'idempotency-key': 'invite-1' },
        payload: { modo_ativacao: 'ativar_usuario' },
      });
      assert.equal(invitation.statusCode, 201);
      assert.deepEqual(invitation.json(), {
        resultado: 'convite_emitido',
        recurso_tipo: 'convite',
        recurso_id: '50000000-0000-4000-8000-000000000001',
      });
      assert.equal(Object.hasOwn(invitation.json(), 'versao'), false);
      assert.deepEqual(
        (target.calls.status as { body: unknown }).body,
        {
          versao: 2,
          status: 'inativo',
          motivo: 'outro',
          motivo_detalhe: 'Encerramento validado',
        },
      );
      assert.deepEqual(
        (target.calls.invitation as { body: unknown }).body,
        { modo_ativacao: 'ativar_usuario' },
      );
    } finally {
      await app.close();
    }
  });

  it('rejeita chave ausente, query e corpo desconhecidos como 400', async () => {
    const target = harness();
    const app = await buildTestApp(target.service);
    try {
      const missingKey = await app.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: { authorization: AUTHORIZATION },
        payload: {
          nome: 'Nome',
          email: 'nome@example.test',
          perfil: 'admin',
        },
      });
      assert.equal(missingKey.statusCode, 400);

      const unknownQuery = await app.inject({
        method: 'GET',
        url: '/v1/usuarios?fazenda_id=legado',
        headers: { authorization: AUTHORIZATION },
      });
      assert.equal(unknownQuery.statusCode, 400);

      const unknownBody = await app.inject({
        method: 'POST',
        url: `/v1/usuarios/${USER_ID}/convites`,
        headers: {
          authorization: AUTHORIZATION,
          'idempotency-key': 'invite-1',
        },
        payload: {
          modo_ativacao: 'ativar_usuario',
          token: 'nao-pode-entrar',
        },
      });
      assert.equal(unknownBody.statusCode, 400);
      assert.equal(target.calls.create, undefined);
      assert.equal(target.calls.invitation, undefined);
    } finally {
      await app.close();
    }
  });

  it('classifica limites formais do cursor como 400 invalid_request', async () => {
    const target = harness();
    const app = await buildTestApp(target.service);
    try {
      for (const cursor of ['', 'x'.repeat(2_049)]) {
        const response = await app.inject({
          method: 'GET',
          url: `/v1/usuarios?cursor=${encodeURIComponent(cursor)}`,
          headers: { authorization: AUTHORIZATION },
        });
        assert.equal(response.statusCode, 400);
        assert.equal(response.json().error.code, 'invalid_request');
      }
      assert.equal(target.calls.list, undefined);
    } finally {
      await app.close();
    }
  });

  it('mapeia JSON malformado para 400 invalid_request sem ecoar o corpo', async () => {
    const target = harness();
    const app = await buildTestApp(target.service);
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/usuarios',
        headers: {
          authorization: AUTHORIZATION,
          'content-type': 'application/json',
          'idempotency-key': 'malformed-json',
        },
        payload: '{"nome":"segredo", ',
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.json().error.code, 'invalid_request');
      assert.equal(response.payload.includes('segredo'), false);
    } finally {
      await app.close();
    }
  });

  it('preserva envelopes seguros para 409 e 422', async () => {
    const target = harness();
    const app = await buildTestApp(target.service);
    try {
      target.setMutationError(conflict());
      const conflictResponse = await app.inject({
        method: 'PATCH',
        url: `/v1/usuarios/${USER_ID}`,
        headers: {
          authorization: AUTHORIZATION,
          'idempotency-key': 'update-conflict',
        },
        payload: { versao: 1, nome: 'Outro nome' },
      });
      assert.equal(conflictResponse.statusCode, 409);
      assert.equal(conflictResponse.json().error.code, 'conflict');
      assert.equal(conflictResponse.json().error.request_id, 'req-admin-users');

      target.setMutationError(unprocessableEntity());
      const semanticResponse = await app.inject({
        method: 'POST',
        url: `/v1/usuarios/${USER_ID}/convites`,
        headers: {
          authorization: AUTHORIZATION,
          'idempotency-key': 'invite-semantic',
        },
        payload: { modo_ativacao: 'manter_status' },
      });
      assert.equal(semanticResponse.statusCode, 422);
      assert.equal(semanticResponse.json().error.code, 'validation_error');
    } finally {
      await app.close();
    }
  });
});
