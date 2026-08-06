import { getPropriedadeId, getPropriedadeNome } from './propriedadeCompat';

type Registro = Record<string, any>;

export const FILTRO_TODOS = 'todas';

const texto = (...valores: unknown[]): string => {
  for (const valor of valores) {
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }
  return '';
};

const chaveTexto = (valor: unknown): string =>
  texto(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const getUfPropriedade = (propriedade: Registro): string =>
  texto(propriedade?.uf_sigla, propriedade?.estado).toUpperCase();

export const getUfIdPropriedade = (propriedade: Registro): string =>
  texto(propriedade?.uf_id);

export const getMunicipioNomePropriedade = (propriedade: Registro): string =>
  texto(propriedade?.municipio_nome, propriedade?.cidade);

export const getMunicipioIdPropriedade = (propriedade: Registro): string => {
  const id = texto(propriedade?.municipio_id);
  if (id) return id;

  const nome = getMunicipioNomePropriedade(propriedade);
  const uf = getUfPropriedade(propriedade);
  return nome ? `local:${chaveTexto(uf)}:${chaveTexto(nome)}` : '';
};

export type MunicipioFiltroOption = {
  id: string;
  nome: string;
  uf: string;
  ufId: string;
};

export type UfFiltroOption = {
  id: string;
  sigla: string;
};

export type PropriedadeFiltroOption = {
  id: string;
  nome: string;
  titular: string;
  municipio: string;
  municipioId: string;
  uf: string;
};

export const listarUfs = (propriedades: Registro[] = []): string[] =>
  [...new Set(propriedades.map(getUfPropriedade).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const listarUfsParaCadastro = (propriedades: Registro[] = []): UfFiltroOption[] => {
  const opcoes = new Map<string, UfFiltroOption>();
  propriedades.forEach((propriedade) => {
    const sigla = getUfPropriedade(propriedade);
    const id = getUfIdPropriedade(propriedade);
    if (sigla && id && !opcoes.has(sigla)) opcoes.set(sigla, { id, sigla });
  });
  return [...opcoes.values()].sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR'));
};

export const listarMunicipios = (
  propriedades: Registro[] = [],
  uf = FILTRO_TODOS,
): MunicipioFiltroOption[] => {
  const opcoes = new Map<string, MunicipioFiltroOption>();

  propriedades.forEach((propriedade) => {
    const propriedadeUf = getUfPropriedade(propriedade);
    if (uf !== FILTRO_TODOS && propriedadeUf !== uf) return;

    const id = getMunicipioIdPropriedade(propriedade);
    const nome = getMunicipioNomePropriedade(propriedade);
    if (id && nome && !opcoes.has(id)) {
      opcoes.set(id, { id, nome, uf: propriedadeUf, ufId: getUfIdPropriedade(propriedade) });
    }
  });

  return [...opcoes.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR') || a.uf.localeCompare(b.uf, 'pt-BR')
  );
};

export const listarPropriedadesParaFiltro = (
  propriedades: Registro[] = [],
  uf = FILTRO_TODOS,
  municipio = FILTRO_TODOS,
): PropriedadeFiltroOption[] => propriedades
  .filter((propriedade) => uf === FILTRO_TODOS || getUfPropriedade(propriedade) === uf)
  .filter((propriedade) => (
    municipio === FILTRO_TODOS || getMunicipioIdPropriedade(propriedade) === municipio
  ))
  .map((propriedade) => ({
    id: texto(propriedade?.propriedade_id, getPropriedadeId(propriedade), propriedade?.id),
    nome: getPropriedadeNome(propriedade) || '',
    titular: texto(propriedade?.titular_nome, propriedade?.produtor_nome),
    municipio: getMunicipioNomePropriedade(propriedade),
    municipioId: getMunicipioIdPropriedade(propriedade),
    uf: getUfPropriedade(propriedade),
  }))
  .filter((propriedade) => propriedade.id && propriedade.nome)
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

export type FiltrosTerritoriais = {
  uf?: string;
  municipio?: string;
  propriedadeId?: string | null;
};

export const filtrarPropriedadesPorLocalizacao = (
  propriedades: Registro[] = [],
  filtros: FiltrosTerritoriais = {},
): Registro[] => propriedades
  .filter((propriedade) => (
    !filtros.uf || filtros.uf === FILTRO_TODOS || getUfPropriedade(propriedade) === filtros.uf
  ))
  .filter((propriedade) => (
    !filtros.municipio
    || filtros.municipio === FILTRO_TODOS
    || getMunicipioIdPropriedade(propriedade) === filtros.municipio
  ))
  .filter((propriedade) => (
    !filtros.propriedadeId
    || texto(propriedade?.propriedade_id, getPropriedadeId(propriedade), propriedade?.id)
      === filtros.propriedadeId
  ));
