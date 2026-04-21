import { getFazendaId, getNomeFazenda, getNomeTitularFazenda } from './acessoControle';

const toSearchableText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const joinDefined = (values: unknown[], separator: string): string =>
  values
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => String(value).trim())
    .join(separator);

export type FazendaUiInfo = {
  id: string;
  fazendaNome: string;
  titularNome: string;
  localizacao: string;
  buscaTexto: string;
};

export const getFazendaUiInfo = (fazenda: any): FazendaUiInfo => {
  const fazendaNome = getNomeFazenda(fazenda);
  const titularNome = getNomeTitularFazenda(fazenda);
  const localizacao = joinDefined([fazenda?.cidade, fazenda?.estado], '/');
  const buscaTexto = joinDefined(
    [fazendaNome, titularNome, fazenda?.cidade, fazenda?.estado, fazenda?.regiao, fazenda?.microregiao],
    ' '
  ).toLowerCase();

  return {
    id: getFazendaId(fazenda),
    fazendaNome,
    titularNome,
    localizacao,
    buscaTexto,
  };
};

export const matchesFazendaUiBusca = (
  fazenda: any,
  busca?: string | null,
  extras: unknown[] = []
): boolean => {
  const termoBusca = toSearchableText(busca);
  if (!termoBusca) {
    return true;
  }

  const info = getFazendaUiInfo(fazenda);
  const extrasTexto = extras.map(toSearchableText).filter(Boolean).join(' ');
  const contextoBusca = joinDefined([info.buscaTexto, extrasTexto], ' ').toLowerCase();

  return contextoBusca.includes(termoBusca);
};
