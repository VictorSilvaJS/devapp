import { ApiResponseError, InvalidApiRequestError } from './backendApi';
import { AdministrativeUserAccessDeniedError } from './administrativeUserRepository';
import { InvalidBackendResponseError } from './decoders';
import { ApiTransportError } from './httpTransport';
import { SessionRequiredError, SessionStorageError } from './sessionCoordinator';

function apiMessage(error: ApiResponseError): string {
  if (error.status === 401 && error.code === 'invalid_credentials') {
    return 'E-mail ou senha inválidos.';
  }
  if (error.status === 401) return 'Sua sessão não é mais válida.';
  if (error.status === 403) return 'Você não possui permissão para esta ação.';
  if (error.status === 404) return 'O recurso não foi encontrado.';
  if (error.status === 409) return 'A operação conflita com o estado atual.';
  if (error.status === 422) return 'Revise os dados informados.';
  if (error.status === 429) return 'Muitas tentativas. Aguarde e tente novamente.';
  if (error.status === 503) return 'Serviço temporariamente indisponível.';
  if (error.status === 400) return 'A solicitação é inválida.';
  return 'Não foi possível concluir a operação.';
}

export function safeClientErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseError) return apiMessage(error);
  if (error instanceof InvalidApiRequestError) return error.message;
  if (error instanceof AdministrativeUserAccessDeniedError) return error.message;
  if (error instanceof ApiTransportError) return 'Não foi possível conectar ao serviço.';
  if (error instanceof InvalidBackendResponseError) {
    return 'O serviço retornou uma resposta incompatível.';
  }
  if (error instanceof SessionRequiredError || error instanceof SessionStorageError) {
    return error.message;
  }
  return 'Não foi possível concluir a operação.';
}
