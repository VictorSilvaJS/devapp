import type { AdministrativeUserDetail, AdministrativeUserPropertyDelta, AdministrativeUserPropertyFilters,
  AdministrativeUserPropertyRelation, AdministrativeReasonCode } from './contracts';
import { isCanonicalUuidV4 } from './decoders';
import { PROPERTY_REASON_CODES } from './administrativePropertyModels';

export class InvalidUserPropertyModelError extends Error {
  constructor(message = 'Revise os vínculos e o motivo informado.') { super(message); }
}
function exact(value: unknown, allowed: string[], required: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new InvalidUserPropertyModelError();
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) throw new InvalidUserPropertyModelError();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new InvalidUserPropertyModelError();
    result[key] = descriptor.value;
  }
  if (required.some(key => !Object.hasOwn(result, key))) throw new InvalidUserPropertyModelError();
  return result;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value || value !== value.trim() || [...value.normalize('NFC')].length > max) throw new InvalidUserPropertyModelError();
  return value.normalize('NFC');
}
export function validateUserPropertyFilters(value: unknown): AdministrativeUserPropertyFilters {
  const input = exact(value, ['busca', 'tipo_acesso', 'status_vinculo', 'limite', 'cursor'], []);
  const limit = input.limite ?? 50;
  if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 100 ||
    ('tipo_acesso' in input && !['titular', 'usuario_autorizado', 'colaborador'].includes(input.tipo_acesso as string)) ||
    ('status_vinculo' in input && !['ativo', 'inativo'].includes(input.status_vinculo as string))) throw new InvalidUserPropertyModelError();
  return Object.freeze({ ...input, limite: limit,
    ...('busca' in input ? { busca: text(input.busca, 200) } : {}),
    ...('cursor' in input ? { cursor: text(input.cursor, 2048) } : {}) }) as AdministrativeUserPropertyFilters;
}
export function validateUserPropertyDelta(value: unknown): AdministrativeUserPropertyDelta & Readonly<Record<string, unknown>> {
  const input = exact(value, ['versao', 'adicionar', 'remover', 'motivo', 'motivo_detalhe'], ['versao', 'adicionar', 'remover', 'motivo']);
  if (!Number.isSafeInteger(input.versao) || (input.versao as number) < 1) throw new InvalidUserPropertyModelError();
  if (!Array.isArray(input.adicionar) || !Array.isArray(input.remover)) throw new InvalidUserPropertyModelError();
  const ids = [...input.adicionar, ...input.remover];
  if (!ids.length || ids.length > 100 || ids.some(id => !isCanonicalUuidV4(id)) || new Set(ids).size !== ids.length) throw new InvalidUserPropertyModelError('Selecione de 1 a 100 Propriedades distintas por alteração.');
  if (!PROPERTY_REASON_CODES.includes(input.motivo as AdministrativeReasonCode)) throw new InvalidUserPropertyModelError('Selecione um motivo administrativo.');
  const detail = 'motivo_detalhe' in input ? text(input.motivo_detalhe, 300) : undefined;
  if (input.motivo === 'outro' && detail === undefined) throw new InvalidUserPropertyModelError('Detalhe o motivo Outro em até 300 caracteres.');
  return Object.freeze({ versao: input.versao as number, adicionar: Object.freeze([...input.adicionar].sort()),
    remover: Object.freeze([...input.remover].sort()), motivo: input.motivo as AdministrativeReasonCode,
    ...(detail === undefined ? {} : { motivo_detalhe: detail }) });
}

/** Only explicitly touched IDs become a delta; a page or filter is never a complete baseline. */
export class UserPropertyEditModel {
  readonly known = new Map<string, AdministrativeUserPropertyRelation>();
  readonly additions = new Map<string, string>();
  readonly removals = new Map<string, string>();
  constructor(readonly user: AdministrativeUserDetail) {}
  remember(items: readonly AdministrativeUserPropertyRelation[]) {
    for (const item of items) {
      this.known.set(item.id, item);
      if (item.origem_acesso === 'titularidade') {
        this.additions.delete(item.propriedade_id); this.removals.delete(item.propriedade_id);
      } else if (item.status_vinculo === 'ativo') this.additions.delete(item.propriedade_id);
    }
  }
  relation(propertyId: string) {
    const items = [...this.known.values()].filter(item => item.propriedade_id === propertyId);
    return items.find(item => item.origem_acesso === 'titularidade') ??
      items.find(item => item.status_vinculo === 'ativo') ?? items[0];
  }
  set(propertyId: string, name: string, active: boolean) {
    const known = this.relation(propertyId);
    if (this.user.perfil === 'admin' || !isCanonicalUuidV4(propertyId) || known?.origem_acesso === 'titularidade') return;
    this.additions.delete(propertyId); this.removals.delete(propertyId);
    if (active && known?.status_vinculo !== 'ativo') this.additions.set(propertyId, name);
    if (!active && known?.status_vinculo === 'ativo' && known.editavel) this.removals.set(propertyId, name);
  }
  get count() { return this.additions.size + this.removals.size; }
  payload(reason: string, detail: string) {
    if (this.user.perfil === 'admin') throw new InvalidUserPropertyModelError('Administrador tem acesso global e não recebe vínculo direto.');
    return validateUserPropertyDelta({ versao: this.user.versao, adicionar: [...this.additions.keys()], remover: [...this.removals.keys()],
      motivo: reason, ...(detail === '' ? {} : { motivo_detalhe: detail }) });
  }
}

export function userPropertyAccessLabel(user: AdministrativeUserDetail, relation: AdministrativeUserPropertyRelation): string {
  if (user.status !== 'ativo') return 'Sem acesso efetivo: Usuário não está ativo.';
  if (relation.propriedade_status !== 'ativa') return 'Sem acesso efetivo: Propriedade inativa.';
  if (relation.origem_acesso === 'vinculo_direto' && relation.status_vinculo !== 'ativo') return 'Este vínculo inativo não concede acesso; outros acessos podem existir.';
  // The relation API does not expose produtores.status. Never invent that eligibility.
  if (user.perfil === 'produtor' && relation.origem_acesso === 'vinculo_direto') return 'Vínculo ativo. Acesso depende também da habilitação do Produtor no servidor.';
  return 'Condições de acesso atendidas nesta leitura; autorização validada pelo servidor.';
}
