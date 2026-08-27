import type { PoolClient } from 'pg';

import { query } from '../auth/postgres-common.js';

const RUNTIME_AUDIT_FUNCTIONS = {
  'auth.convite.aceito': 'tche_aud_convite_aceito_mp35b',
  'auth.convite.criado': 'tche_aud_convite_criado_mp35b',
  'auth.email_principal.alteracao_solicitada':
    'tche_aud_email_principal_solicitada_mp35b',
  'auth.email_principal.alterado': 'tche_aud_email_principal_alterado_mp35b',
  'auth.email_principal.endereco_atual_confirmado':
    'tche_aud_email_principal_atual_confirmado_mp35b',
  'auth.email_secundario.verificacao_solicitada':
    'tche_aud_email_secundario_solicitada_mp35b',
  'auth.email_secundario.verificado':
    'tche_aud_email_secundario_verificado_mp35b',
  'auth.recuperacao_admin.break_glass_concluida':
    'tche_aud_rec_admin_breakglass_concluida_mp35b',
  'auth.recuperacao_admin.break_glass_iniciada':
    'tche_aud_rec_admin_breakglass_iniciada_mp35b',
  'auth.recuperacao_admin.email_confirmado':
    'tche_aud_rec_admin_breakglass_email_mp35b',
  'auth.recuperacao_admin.novo_email_confirmado':
    'tche_aud_rec_admin_novo_email_mp35b',
  'auth.recuperacao_admin.secundario_cancelada':
    'tche_aud_rec_admin_sec_cancelada_mp35b',
  'auth.recuperacao_admin.secundario_concluida':
    'tche_aud_rec_admin_sec_concluida_mp35b',
  'auth.recuperacao_admin.secundario_confirmado':
    'tche_aud_rec_admin_sec_confirmado_mp35b',
  'auth.recuperacao_admin.secundario_solicitada':
    'tche_aud_rec_admin_sec_solicitada_mp35b',
  'auth.recuperacao_assistida.aprovada':
    'tche_aud_rec_assist_aprovada_mp35b',
  'auth.recuperacao_assistida.cancelada':
    'tche_aud_rec_assist_cancelada_mp35b',
  'auth.recuperacao_assistida.concluida':
    'tche_aud_rec_assist_concluida_mp35b',
  'auth.recuperacao_assistida.email_confirmado':
    'tche_aud_rec_assist_email_mp35b',
  'auth.recuperacao_assistida.solicitada':
    'tche_aud_rec_assist_solicitada_mp35b',
  'auth.recuperacao_senha.concluida': 'tche_aud_rec_senha_concluida_mp35b',
  'auth.recuperacao_senha.solicitada': 'tche_aud_rec_senha_solicitada_mp35b',
  'auth.refresh.reutilizado': 'tche_aud_refresh_reutilizado_mp35b',
  'auth.refresh.rotacionado': 'tche_aud_refresh_rotacionado_mp35b',
  'auth.senha.alterada': 'tche_aud_senha_alterada_mp35b',
  'auth.sessao.criada': 'tche_aud_sessao_criada_mp35b',
  'auth.sessao.logout': 'tche_aud_sessao_logout_mp35b',
  'auth.sessao.logout_todas': 'tche_aud_sessao_logout_todas_mp35b',
  'auth.sessao.revogada': 'tche_aud_sessao_revogada_mp35b',
  'notificacao.descartada': 'tche_aud_notificacao_descartada_mp35b',
  'notificacao.leituras_em_lote':
    'tche_aud_notificacao_leituras_lote_mp35b',
  'notificacao.lida': 'tche_aud_notificacao_lida_mp35b',
} as const satisfies Readonly<Record<string, string>>;

export interface RuntimeAuditDraft {
  readonly id?: string;
  readonly organizationId: string;
  readonly event: string;
  readonly result: 'sucesso' | 'negado' | 'falha';
  readonly actorType: 'usuario' | 'sistema' | 'plataforma';
  readonly actorUserId?: string;
  readonly sessionId?: string;
  readonly affectedUserId?: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly reasonCategory?: string;
  readonly externalReferenceHmac?: Buffer;
  readonly requestId?: string;
  readonly emailHmac?: Buffer;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly occurredAt?: Date;
}

export async function insertRuntimeAudit(
  client: PoolClient,
  draft: RuntimeAuditDraft,
): Promise<void> {
  const functionName =
    RUNTIME_AUDIT_FUNCTIONS[
      draft.event as keyof typeof RUNTIME_AUDIT_FUNCTIONS
    ];
  if (functionName === undefined) {
    throw new Error(`Unsupported runtime audit event: ${draft.event}`);
  }

  await query(
    client,
    `SELECT public.${functionName}($1::jsonb)`,
    [
      JSON.stringify({
        ...(draft.id === undefined ? {} : { id: draft.id }),
        organizationId: draft.organizationId,
        result: draft.result,
        actorType: draft.actorType,
        ...(draft.actorUserId === undefined
          ? {}
          : { actorUserId: draft.actorUserId }),
        ...(draft.sessionId === undefined ? {} : { sessionId: draft.sessionId }),
        ...(draft.affectedUserId === undefined
          ? {}
          : { affectedUserId: draft.affectedUserId }),
        resourceType: draft.resourceType,
        resourceId: draft.resourceId,
        ...(draft.reasonCategory === undefined
          ? {}
          : { reasonCategory: draft.reasonCategory }),
        ...(draft.externalReferenceHmac === undefined
          ? {}
          : {
              externalReferenceHmacHex:
                draft.externalReferenceHmac.toString('hex'),
            }),
        ...(draft.requestId === undefined ? {} : { requestId: draft.requestId }),
        ...(draft.emailHmac === undefined
          ? {}
          : { emailHmacHex: draft.emailHmac.toString('hex') }),
        metadata: draft.metadata,
        ...(draft.occurredAt === undefined
          ? {}
          : { occurredAt: draft.occurredAt.toISOString() }),
      }),
    ],
  );
}
