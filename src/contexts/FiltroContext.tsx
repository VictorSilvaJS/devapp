import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Produtor } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import {
  normalizeFiltrosState,
  resolveFiltroFazendaId,
  toFiltrosCompativeis,
} from './filtroCompat';
import { getFazendaId, getNomeFazenda, getNomeTitularFazenda } from '../utils/acessoControle';

const FiltroContext = createContext<any>(null);

const createFiltrosIniciais = () => normalizeFiltrosState();

export function FiltroProvider({ children }) {
  const { user } = useAuthState();
  const prevUserIdRef = useRef(null);

  const [filtrosState, setFiltrosState] = useState(createFiltrosIniciais);

  const [regioes, setRegioes] = useState([]);
  const [microregioes, setMicroregioes] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [cidades, setCidades] = useState([]);
  const filtros = toFiltrosCompativeis(filtrosState);

  const updateFiltros = (patch) => {
    setFiltrosState((prev) => normalizeFiltrosState({ ...prev, ...patch }));
  };

  // Resetar todos os filtros quando o usuário mudar (logout/login diferente)
  useEffect(() => {
    const currentUserId = user?.id || null;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentUserId) {
      console.log('[FiltroContext] Usuário mudou, resetando filtros');
      setFiltrosState(createFiltrosIniciais());
    }
    prevUserIdRef.current = currentUserId;
  }, [user?.id]);

  // Carregar opções de filtro disponíveis
  useEffect(() => {
    loadOpcoesDisponiveis();
  }, []);

  // Atualizar microregiões e fazendas quando região mudar
  useEffect(() => {
    loadMicroregioes();
  }, [filtrosState.regiao]);

  // Atualizar fazendas disponíveis quando região ou microregião mudar
  useEffect(() => {
    loadFazendas();
  }, [filtrosState.regiao, filtrosState.microregiao]);

  const loadOpcoesDisponiveis = async () => {
    try {
      const produtores = await Produtor.list();

      // Extrair regiões únicas
      const regioesUnicas = [...new Set(produtores.map(p => p.regiao).filter(Boolean))].sort();
      setRegioes(regioesUnicas);

      // Extrair cidades únicas
      const cidadesUnicas = [...new Set(produtores.map(p => p.cidade).filter(Boolean))].sort();
      setCidades(cidadesUnicas);

      // Extrair microregiões únicas (todas)
      const microregioesUnicas = [...new Set(produtores.map(p => p.microregiao).filter(Boolean))].sort();
      setMicroregioes(microregioesUnicas);

    } catch (error) {
      console.error('Erro ao carregar opções de filtro:', error);
    }
  };

  const loadMicroregioes = async () => {
    try {
      const produtores = await Produtor.list();
      let produtoresFiltrados = produtores;

      if (filtrosState.regiao !== 'todas') {
        produtoresFiltrados = produtoresFiltrados.filter(p => p.regiao === filtrosState.regiao);
      }

      const microregioesUnicas = [...new Set(produtoresFiltrados.map(p => p.microregiao).filter(Boolean))].sort();
      setMicroregioes(microregioesUnicas);
    } catch (error) {
      console.error('Erro ao carregar microregiões:', error);
    }
  };

  const loadFazendas = async () => {
    try {
      const produtores = await Produtor.list();
      let produtoresFiltrados = produtores;

      // Filtrar por região se selecionada
      if (filtrosState.regiao !== 'todas') {
        produtoresFiltrados = produtoresFiltrados.filter(p => p.regiao === filtrosState.regiao);
      }

      // Filtrar por microregião se selecionada
      if (filtrosState.microregiao !== 'todas') {
        produtoresFiltrados = produtoresFiltrados.filter(p => p.microregiao === filtrosState.microregiao);
      }

      // Extrair fazendas com seus IDs
      const fazendasDisponiveis = produtoresFiltrados
        .filter(p => p.fazenda)
        .map(p => ({
          id: getFazendaId(p),
          nome: getNomeFazenda(p),
          produtor: getNomeTitularFazenda(p),
          cidade: p.cidade,
          regiao: p.regiao,
          microregiao: p.microregiao,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setFazendas(fazendasDisponiveis);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
    }
  };

  const setRegiao = (regiao) => {
    updateFiltros({
      regiao,
      microregiao: 'todas', // Resetar microregião ao mudar região
      fazenda: 'todas',
      fazendaId: null,
    });
  };

  const setMicroregiao = (microregiao) => {
    updateFiltros({
      microregiao,
      fazenda: 'todas', // Resetar fazenda ao mudar microregião
      fazendaId: null,
    });
  };

  const setFazenda = (fazenda, fazendaId = null) => {
    updateFiltros({
      fazenda,
      fazendaId,
    });
  };

  const setCidade = (cidade) => {
    updateFiltros({
      cidade,
    });
  };

  const limparFiltros = () => {
    setFiltrosState(createFiltrosIniciais());
  };

  const getFiltroAtivo = () => {
    const parts = [];
    const fazendaIdSelecionada = resolveFiltroFazendaId(filtrosState);
    if (filtrosState.regiao !== 'todas') parts.push(filtrosState.regiao);
    if (filtrosState.microregiao !== 'todas') parts.push(filtrosState.microregiao);
    if (filtrosState.fazenda !== 'todas') {
      const fazendaInfo = fazendas.find(f => f.id === fazendaIdSelecionada);
      parts.push(fazendaInfo ? fazendaInfo.nome : 'Fazenda Selecionada');
    }
    if (filtrosState.cidade !== 'todas') parts.push(filtrosState.cidade);
    return parts.length > 0 ? parts.join(' • ') : 'Todas as Regiões';
  };

  const temFiltroAtivo = () => {
    return filtrosState.regiao !== 'todas' || 
           filtrosState.microregiao !== 'todas' ||
           filtrosState.fazenda !== 'todas' || 
           filtrosState.cidade !== 'todas';
  };

  // Função auxiliar para filtrar produtores baseado nos filtros ativos
  const filtrarProdutores = (produtores) => {
    if (!produtores) return [];
    
    let resultado = [...produtores];

    // Filtro por região
    if (filtrosState.regiao !== 'todas') {
      resultado = resultado.filter(p => p.regiao === filtrosState.regiao);
    }

    // Filtro por microregião
    if (filtrosState.microregiao !== 'todas') {
      resultado = resultado.filter(p => p.microregiao === filtrosState.microregiao);
    }

    // Filtro por cidade
    if (filtrosState.cidade !== 'todas') {
      resultado = resultado.filter(p => p.cidade === filtrosState.cidade);
    }

    // Filtro por fazenda específica
    if (filtrosState.fazenda !== 'todas' && filtrosState.fazendaId) {
      resultado = resultado.filter(p => getFazendaId(p) === filtrosState.fazendaId);
    }

    return resultado;
  };

  // Função auxiliar para obter IDs das fazendas filtradas
  const getFazendaIdsFiltrados = (produtores) => {
    const produtoresFiltrados = filtrarProdutores(produtores);
    return produtoresFiltrados.map(p => getFazendaId(p)).filter(Boolean);
  };

  // Alias temporário para evitar mudanças amplas na UI neste lote.
  const getProdutorIdsFiltrados = (produtores) => getFazendaIdsFiltrados(produtores);

  const value = {
    filtros,
    regioes,
    microregioes,
    fazendas,
    cidades,
    setRegiao,
    setMicroregiao,
    setFazenda,
    setCidade,
    limparFiltros,
    getFiltroAtivo,
    temFiltroAtivo,
    filtrarProdutores,
    getFazendaIdsFiltrados,
    getProdutorIdsFiltrados,
  };

  return (
    <FiltroContext.Provider value={value}>
      {children}
    </FiltroContext.Provider>
  );
}

export function useFiltros() {
  const context = useContext(FiltroContext);
  if (!context) {
    throw new Error('useFiltros deve ser usado dentro de um FiltroProvider');
  }
  return context;
}
