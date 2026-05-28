import { getFazendaId } from './acessoControle';
import {
  getSubRegioesUsuario,
  getVinculosMicroregiaoUsuario,
  getVinculosPropriedadeUsuario,
} from './usuarioAdminCompat';

const normalizarTexto = (valor: any): string => {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
};

const normalizarComparacao = (valor: any): string =>
  normalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const slug = (valor: any): string => {
  const base = normalizarComparacao(valor)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'sem-identificacao';
};

const ordenarPorNome = <T extends { nome: string }>(itens: T[]): T[] =>
  [...itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

const getSubRegioesLegadasUsuario = (usuario: any): string[] =>
  Array.isArray(usuario?.sub_regioes)
    ? usuario.sub_regioes.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

export const gerarRegiaoId = (regiao: any): string => `regiao_${slug(regiao)}`;

export const gerarMicroregiaoId = (regiao: any, microregiao: any): string =>
  `microregiao_${slug(regiao)}_${slug(microregiao)}`;

export const getRegiaoPropriedade = (propriedade: any): string =>
  normalizarTexto(propriedade?.regiao);

export const getMicroregiaoPropriedade = (propriedade: any): string =>
  normalizarTexto(propriedade?.microregiao);

export const listarRegioes = (propriedades: any[] = []) => {
  const mapa = new Map<string, { id: string; nome: string }>();

  propriedades.forEach((propriedade) => {
    const nome = getRegiaoPropriedade(propriedade);
    if (!nome) return;

    const chave = normalizarComparacao(nome);
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        id: gerarRegiaoId(nome),
        nome,
      });
    }
  });

  return ordenarPorNome(Array.from(mapa.values()));
};

export const listarMicroregioes = (propriedades: any[] = [], regiao?: string) => {
  const regiaoFiltro = normalizarComparacao(regiao);
  const mapa = new Map<string, { id: string; nome: string; regiao: string; regiao_id: string }>();

  propriedades.forEach((propriedade) => {
    const nome = getMicroregiaoPropriedade(propriedade);
    const nomeRegiao = getRegiaoPropriedade(propriedade);
    if (!nome) return;
    if (regiaoFiltro && normalizarComparacao(nomeRegiao) !== regiaoFiltro) return;

    const chave = `${normalizarComparacao(nomeRegiao)}:${normalizarComparacao(nome)}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        id: gerarMicroregiaoId(nomeRegiao, nome),
        nome,
        regiao: nomeRegiao,
        regiao_id: gerarRegiaoId(nomeRegiao),
      });
    }
  });

  return ordenarPorNome(Array.from(mapa.values()));
};

export const listarMicroregioesPorRegiao = (propriedades: any[] = [], regiao?: string) =>
  listarMicroregioes(propriedades, regiao);

export const listarPropriedadesPorMicroregiao = (
  propriedades: any[] = [],
  microregiao?: string,
  regiao?: string,
) => {
  const microFiltro = normalizarComparacao(microregiao);
  const regiaoFiltro = normalizarComparacao(regiao);

  if (!microFiltro) return [];

  return propriedades.filter((propriedade) => {
    const mesmaMicroregiao = normalizarComparacao(getMicroregiaoPropriedade(propriedade)) === microFiltro;
    const mesmaRegiao = !regiaoFiltro || normalizarComparacao(getRegiaoPropriedade(propriedade)) === regiaoFiltro;
    return mesmaMicroregiao && mesmaRegiao;
  });
};

export const listarPropriedadesPorMicroregioes = (
  propriedades: any[] = [],
  microregioes: string[] = [],
  regiao?: string,
) => {
  const mapa = new Map<string, any>();

  microregioes.forEach((microregiao) => {
    listarPropriedadesPorMicroregiao(propriedades, microregiao, regiao).forEach((propriedade) => {
      mapa.set(getFazendaId(propriedade), propriedade);
    });
  });

  return Array.from(mapa.values());
};

export const colaboradorAtendeMicroregiao = (
  usuario: any,
  microregiao?: string,
  regiao?: string,
): boolean => {
  if (usuario?.perfil !== 'colaborador') return false;

  const microFiltro = normalizarComparacao(microregiao);
  const regiaoFiltro = normalizarComparacao(regiao);
  if (!microFiltro) return false;

  const atendePorVinculo = getVinculosMicroregiaoUsuario(usuario).some((vinculo) => {
    const mesmaMicroregiao = normalizarComparacao(vinculo.microregiao) === microFiltro;
    const mesmaRegiao =
      !regiaoFiltro ||
      !normalizarTexto(vinculo.regiao) ||
      normalizarComparacao(vinculo.regiao) === regiaoFiltro;

    return mesmaMicroregiao && mesmaRegiao;
  });

  if (atendePorVinculo) return true;

  const subRegioesCompat = Array.from(
    new Set([...getSubRegioesUsuario(usuario), ...getSubRegioesLegadasUsuario(usuario)])
  );

  return subRegioesCompat.some(
    (subRegiao) => normalizarComparacao(subRegiao) === microFiltro,
  );
};

export const sugerirColaboradoresParaMicroregiao = (
  usuarios: any[] = [],
  microregiao?: string,
  regiao?: string,
  propriedades: any[] = [],
) => {
  const propriedadesNaMicroregiao = listarPropriedadesPorMicroregiao(
    propriedades,
    microregiao,
    regiao,
  );
  const idsPropriedades = new Set(propriedadesNaMicroregiao.map((propriedade) => getFazendaId(propriedade)));

  return usuarios.filter((usuario) => {
    if (usuario?.perfil !== 'colaborador') return false;
    if (colaboradorAtendeMicroregiao(usuario, microregiao, regiao)) return true;

    return getVinculosPropriedadeUsuario(usuario, propriedades).some((vinculo) =>
      idsPropriedades.has(vinculo.propriedade_id),
    );
  });
};

export const getUsuariosProdutoresDaPropriedade = (
  usuarios: any[] = [],
  propriedade: any,
  propriedades: any[] = [],
) => {
  const propriedadeId = getFazendaId(propriedade);

  return usuarios.filter((usuario) => {
    if (usuario?.perfil !== 'produtor') return false;
    return getVinculosPropriedadeUsuario(usuario, propriedades).some(
      (vinculo) => vinculo.propriedade_id === propriedadeId,
    );
  });
};

export const getColaboradoresRelacionadosAPropriedade = (
  usuarios: any[] = [],
  propriedade: any,
  propriedades: any[] = [],
) => {
  const propriedadeId = getFazendaId(propriedade);
  const microregiao = getMicroregiaoPropriedade(propriedade);
  const regiao = getRegiaoPropriedade(propriedade);

  return usuarios.filter((usuario) => {
    if (usuario?.perfil !== 'colaborador') return false;

    const temVinculoDireto = getVinculosPropriedadeUsuario(usuario, propriedades).some(
      (vinculo) => vinculo.propriedade_id === propriedadeId,
    );
    if (temVinculoDireto) return true;

    return colaboradorAtendeMicroregiao(usuario, microregiao, regiao);
  });
};
