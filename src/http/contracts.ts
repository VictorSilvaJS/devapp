export type HttpProfile = 'admin' | 'colaborador' | 'produtor';
export type HttpUserStatus = 'pendente' | 'ativo' | 'inativo';
export type PropertyStatus = 'ativa' | 'inativa';
export type PropertyAccessType =
  | 'admin'
  | 'titular'
  | 'usuario_autorizado'
  | 'colaborador';

export interface HttpUser {
  readonly id: string;
  readonly organizacao_id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: HttpProfile;
  readonly status: HttpUserStatus;
  readonly versao_autorizacao: number;
}

export interface HttpScope {
  readonly modo: 'organizacao' | 'vinculos_propriedade';
  readonly versao: number;
}

export interface HttpSessionIdentity {
  readonly id: string;
  readonly usuario: HttpUser;
  readonly escopo: HttpScope;
}

export interface TokenResponse extends HttpSessionIdentity {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: 'Bearer';
  readonly expires_in: number;
  readonly emitido_em: string;
  readonly access_expira_em: string;
  readonly sessao_expira_inatividade_em: string;
  readonly sessao_expira_absolutamente_em: string;
}

export interface SessionSnapshot extends HttpSessionIdentity {
  readonly emitido_em: string;
  readonly access_expira_em: string;
  readonly sessao_expira_inatividade_em: string;
  readonly sessao_expira_absolutamente_em: string;
  /** Monotonic process-local deadline derived from server timestamps. */
  readonly access_expires_monotonic: number;
}

export interface PropertyOwnerProjection {
  readonly id: string;
  readonly nome: string;
}

export interface PropertyProjection {
  readonly id: string;
  readonly organizacao_id: string;
  readonly titular_id: string;
  readonly titular: PropertyOwnerProjection;
  readonly nome: string;
  readonly municipio_id: string;
  readonly municipio_nome: string;
  readonly uf_id: string;
  readonly uf_sigla: string;
  readonly area_total: number | null;
  readonly cultura_principal: string | null;
  readonly status: PropertyStatus;
  readonly tipo_acesso: PropertyAccessType;
}

/** Versioned view; the current read contract still exposes area_total as a JSON number. */
export interface AdministrativePropertyProjection extends PropertyProjection {
  readonly versao: number;
  readonly criado_em: string;
  readonly atualizado_em: string;
}

export type AdministrativeReceipt =
  | Readonly<{
      resultado: 'criado' | 'atualizado' | 'status_alterado';
      recurso_tipo: 'usuario' | 'propriedade';
      recurso_id: string;
      versao: number;
    }>
  | Readonly<{
      resultado: 'vinculos_alterados';
      recurso_tipo: 'vinculo';
      recurso_id: string;
      versao: number;
    }>
  | Readonly<{
      resultado: 'convite_emitido';
      recurso_tipo: 'convite';
      recurso_id: string;
    }>;

export interface PropertyPage {
  readonly itens: readonly PropertyProjection[];
  readonly paginacao: {
    readonly proximo_cursor: string | null;
  };
}

export interface PropertyFilters {
  readonly busca?: string;
  readonly status?: PropertyStatus;
  readonly uf?: string;
  readonly municipio?: string;
  readonly limite?: number;
  readonly cursor?: string;
}

export type NotificationEventType =
  | 'conta.senha_alterada.v1'
  | 'conta.email_principal_alterado.v1'
  | 'conta.recuperacao_concluida.v1';

export type NotificationState = 'nao_lida' | 'lida' | 'todas';

export interface NotificationProjection {
  readonly id: string;
  readonly tipo_evento: NotificationEventType;
  readonly prioridade: 'baixa' | 'normal' | 'alta';
  readonly criada_em: string;
  readonly lida_em: string | null;
  readonly expira_em: string;
  readonly recurso_tipo: 'conta';
  readonly recurso_id: string;
  readonly conteudo: Readonly<{
    titulo: string;
    resumo: string;
  }>;
}

export interface NotificationPage {
  readonly itens: readonly NotificationProjection[];
  readonly paginacao: Readonly<{
    proximo_cursor: string | null;
  }>;
}

export interface NotificationFilters {
  readonly estado?: NotificationState;
  readonly limite?: number;
  readonly cursor?: string;
}

export interface NotificationUnreadCount {
  readonly total_nao_lidas: number;
}

export interface NotificationReadResult {
  readonly id: string;
  readonly lida_em: string;
}

export interface NotificationReadAllResult {
  readonly corte_em: string;
  readonly atualizadas: number;
}

export interface NotificationDiscardResult {
  readonly id: string;
  readonly descartada_em: string;
}

export interface NotificationDestination {
  readonly recurso_tipo: 'conta';
  readonly recurso_id: string;
}

export type ApiErrorCode =
  | 'invalid_request'
  | 'invalid_credentials'
  | 'invalid_session'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'version_conflict'
  | 'idempotency_conflict'
  | 'business_rule_conflict'
  | 'invalid_semantics'
  | 'validation_error'
  | 'password_policy_violation'
  | 'invalid_or_expired_challenge'
  | 'rate_limited'
  | 'service_unavailable';

export type ApiFailureCode = ApiErrorCode | 'unexpected_response';

export type ApiErrorDetailField =
  | 'nome'
  | 'email'
  | 'perfil'
  | 'telefone'
  | 'documento'
  | 'observacoes'
  | 'versao'
  | 'status'
  | 'motivo'
  | 'motivo_detalhe'
  | 'modo_ativacao'
  | 'titular_id'
  | 'municipio_id'
  | 'area_total'
  | 'cultura_principal'
  | 'adicionar'
  | 'remover'
  | 'busca'
  | 'limite'
  | 'cursor'
  | 'uf_id'
  | 'tipo_acesso'
  | 'status_vinculo';

export type ApiErrorDetailCode =
  | 'required'
  | 'invalid'
  | 'unsupported'
  | 'out_of_range'
  | 'too_short'
  | 'too_long'
  | 'duplicate'
  | 'conflict';

export interface ApiErrorDetail {
  readonly current_version?: number;
  readonly field?: ApiErrorDetailField;
  readonly code?: ApiErrorDetailCode;
}

export interface ApiErrorPayload {
  readonly code: ApiErrorCode;
  readonly request_id?: string;
  readonly details?: readonly ApiErrorDetail[];
}

export interface AcceptedResponse {
  readonly status: 'aceito';
}

export interface RestrictedTokenResponse {
  readonly token: string;
  readonly expira_em: string;
}

export interface RemoteSessionProjection {
  readonly id: string;
  readonly criada_em: string;
  readonly ultima_renovacao_em: string;
  readonly expira_em: string;
  readonly atual: boolean;
  readonly identificacao_cliente?: string;
  readonly revogada_em?: string;
}

export type AccountAction =
  | 'accept-invitation'
  | 'accept-initial-admin-invitation'
  | 'complete-password-recovery'
  | 'confirm-current-primary-email'
  | 'confirm-new-primary-email'
  | 'verify-secondary-email'
  | 'confirm-admin-secondary-recovery'
  | 'confirm-admin-recovery-new-primary'
  | 'confirm-assisted-recovery-email';

export interface ParsedAccountActionLink {
  readonly action: AccountAction;
  readonly token: string;
}
