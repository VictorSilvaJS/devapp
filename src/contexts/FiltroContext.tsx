import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Produtor } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import { filtrarProdutoresPorAcesso } from '../utils/acessoControle';
import {
  FILTRO_TODOS,
  filtrarPropriedadesPorLocalizacao,
  listarMunicipios,
  listarPropriedadesParaFiltro,
  listarUfs,
} from '../utils/filtroTerritorial';
import {
  normalizeFiltrosState,
  resolveFiltroPropriedadeId,
  toFiltrosCompativeis,
} from './filtroCompat';

const FiltroContext = createContext<any>(null);
const createFiltrosIniciais = () => normalizeFiltrosState();

export function FiltroProvider({ children }) {
  const { user } = useAuthState();
  const prevUserIdRef = useRef(null);
  const [filtrosState, setFiltrosState] = useState(createFiltrosIniciais);
  const [propriedadesAutorizadas, setPropriedadesAutorizadas] = useState<any[]>([]);
  const filtros = useMemo(() => toFiltrosCompativeis(filtrosState), [filtrosState]);

  const updateFiltros = (patch) => {
    setFiltrosState((prev) => normalizeFiltrosState({ ...prev, ...patch }));
  };

  const carregarOpcoes = async () => {
    try {
      const propriedades = await Produtor.list();
      setPropriedadesAutorizadas(filtrarProdutoresPorAcesso(propriedades, user));
    } catch (error) {
      console.error('Erro ao carregar opções dos filtros territoriais:', error);
      setPropriedadesAutorizadas([]);
    }
  };

  useEffect(() => {
    const currentUserId = user?.id || null;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentUserId) {
      setFiltrosState(createFiltrosIniciais());
    }
    prevUserIdRef.current = currentUserId;
    carregarOpcoes();
  }, [user]);

  const ufs = useMemo(() => listarUfs(propriedadesAutorizadas), [propriedadesAutorizadas]);
  const municipios = useMemo(
    () => listarMunicipios(propriedadesAutorizadas, filtrosState.uf),
    [filtrosState.uf, propriedadesAutorizadas],
  );
  const propriedades = useMemo(
    () => listarPropriedadesParaFiltro(
      propriedadesAutorizadas,
      filtrosState.uf,
      filtrosState.municipio,
    ),
    [filtrosState.municipio, filtrosState.uf, propriedadesAutorizadas],
  );

  const setUf = (uf) => updateFiltros({
    uf,
    municipio: FILTRO_TODOS,
    propriedade: FILTRO_TODOS,
    propriedadeId: null,
  });

  const setMunicipio = (municipio) => updateFiltros({
    municipio,
    propriedade: FILTRO_TODOS,
    propriedadeId: null,
  });

  const setPropriedade = (propriedade, propriedadeId = null) => updateFiltros({
    propriedade,
    propriedadeId,
  });

  const limparFiltros = () => setFiltrosState(createFiltrosIniciais());

  const getFiltroAtivo = () => {
    const partes: string[] = [];
    if (filtrosState.uf !== FILTRO_TODOS) partes.push(filtrosState.uf);
    if (filtrosState.municipio !== FILTRO_TODOS) {
      const opcao = municipios.find((municipio) => municipio.id === filtrosState.municipio);
      partes.push(opcao ? opcao.nome : 'Município selecionado');
    }
    if (filtrosState.propriedadeId) {
      const opcao = propriedades.find((propriedade) => propriedade.id === filtrosState.propriedadeId);
      partes.push(opcao ? opcao.nome : 'Propriedade selecionada');
    }
    return partes.length ? partes.join(' • ') : 'Todas as propriedades';
  };

  const temFiltroAtivo = () => (
    filtrosState.uf !== FILTRO_TODOS
    || filtrosState.municipio !== FILTRO_TODOS
    || Boolean(filtrosState.propriedadeId)
  );

  // Recebe somente dados já autorizados pelo consumidor. Localização reduz a
  // visualização; nunca amplia o conjunto nem participa da autorização.
  const filtrarProdutores = (propriedadesPermitidas) => filtrarPropriedadesPorLocalizacao(
    propriedadesPermitidas || [],
    {
      uf: filtrosState.uf,
      municipio: filtrosState.municipio,
      propriedadeId: resolveFiltroPropriedadeId(filtrosState),
    },
  );

  const getFazendaIdsFiltrados = (propriedadesPermitidas) =>
    filtrarProdutores(propriedadesPermitidas)
      .map((propriedade) => propriedade?.propriedade_id || propriedade?.id)
      .filter(Boolean);

  const value = {
    filtros,
    ufs,
    municipios,
    propriedades,
    fazendas: propriedades,
    setUf,
    setMunicipio,
    setPropriedade,
    setFazenda: setPropriedade,
    limparFiltros,
    getFiltroAtivo,
    temFiltroAtivo,
    filtrarProdutores,
    getFazendaIdsFiltrados,
    getProdutorIdsFiltrados: getFazendaIdsFiltrados,
    recarregarOpcoes: carregarOpcoes,
  };

  return <FiltroContext.Provider value={value}>{children}</FiltroContext.Provider>;
}

export function useFiltros() {
  const context = useContext(FiltroContext);
  if (!context) throw new Error('useFiltros deve ser usado dentro de um FiltroProvider');
  return context;
}
