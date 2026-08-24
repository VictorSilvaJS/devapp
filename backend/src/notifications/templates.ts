import { serviceUnavailable } from '../security/http-error.js';
import type {
  NotificationContent,
  NotificationEventType,
} from './contracts.js';

const TEMPLATES = Object.freeze<
  Record<NotificationEventType, NotificationContent>
>({
  'conta.senha_alterada.v1': Object.freeze({
    title: 'Senha alterada',
    summary: 'A senha da sua conta foi alterada.',
  }),
  'conta.email_principal_alterado.v1': Object.freeze({
    title: 'E-mail principal alterado',
    summary: 'O e-mail principal da sua conta foi alterado.',
  }),
  'conta.recuperacao_concluida.v1': Object.freeze({
    title: 'Recuperação concluída',
    summary: 'A recuperação da sua conta foi concluída.',
  }),
});

export function notificationContent(
  eventType: NotificationEventType,
): NotificationContent {
  const template = TEMPLATES[eventType];
  if (template === undefined) throw serviceUnavailable();
  return template;
}
