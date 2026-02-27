import React, { createContext, useContext, useState, useEffect } from 'react';
import { Produtor } from '../api/mock';

const FiltroContext = createContext();

export function FiltroProvider({ children }) {
  const [filtros, setFiltros] = useState({
    regiao: 'todas',
    microregiao: 'todas',
    fazenda: 'todas',
    produtorId: null,
    cidade: 'todas',
  });

  const [regioes, setRegioes] = useState([]);
  const [microregioes, setMicroregioes] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [cidades, setCidades] = useState([]);

  // Carregar opções de filtro disponíveis
  useEffect(() => {
    loadOpcoesDisponiveis();
  }, []);

  // Atualizar microregiões e fazendas quando região mudar
  useEffect(() => {
    loadMicroregioes();
  }, [filtros.regiao]);

  // Atualizar fazendas disponíveis quando região ou microregião mudar
  useEffect(() => {
    loadFazendas();
  }, [filtros.regiao, filtros.microregiao]);

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

      if (filtros.regiao !== 'todas') {
        produtoresFiltrados = produtoresFiltrados.filter(p => p.regiao === filtros.regiao);
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
      if (filtros.regiao !== 'todas') {
        produtoresFiltrados = produtoresFiltrados.filter(p => p.regiao === filtros.regiao);
      }

      // Filtrar por microregião se selecionada
      if (filtros.microregiao !== 'todas') {
        produtoresFiltrados = produtoresFiltrados.filter(p => p.microregiao === filtros.microregiao);
      }

      // Extrair fazendas com seus IDs
      const fazendasDisponiveis = produtoresFiltrados
        .filter(p => p.fazenda)
        .map(p => ({
          id: p.id,
          nome: p.fazenda,
          produtor: p.nome,
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
    setFiltros(prev => ({
      ...prev,
      regiao,
      microregiao: 'todas', // Resetar microregião ao mudar região
      fazenda: 'todas',
      produtorId: null,
    }));
  };

  const setMicroregiao = (microregiao) => {
    setFiltros(prev => ({
      ...prev,
      microregiao,
      fazenda: 'todas', // Resetar fazenda ao mudar microregião
      produtorId: null,
    }));
  };

  const setFazenda = (fazenda, produtorId = null) => {
    setFiltros(prev => ({
      ...prev,
      fazenda,
      produtorId,
    }));
  };

  const setCidade = (cidade) => {
    setFiltros(prev => ({
      ...prev,
      cidade,
    }));
  };

  const limparFiltros = () => {
    setFiltros({
      regiao: 'todas',
      microregiao: 'todas',
      fazenda: 'todas',
      produtorId: null,
      cidade: 'todas',
    });
  };

  const getFiltroAtivo = () => {
    const parts = [];
    if (filtros.regiao !== 'todas') parts.push(filtros.regiao);
    if (filtros.microregiao !== 'todas') parts.push(filtros.microregiao);
    if (filtros.fazenda !== 'todas') {
      const fazendaInfo = fazendas.find(f => f.id === filtros.produtorId);
      parts.push(fazendaInfo ? fazendaInfo.nome : 'Fazenda Selecionada');
    }
    if (filtros.cidade !== 'todas') parts.push(filtros.cidade);
    return parts.length > 0 ? parts.join(' • ') : 'Todas as Regiões';
  };

  const temFiltroAtivo = () => {
    return filtros.regiao !== 'todas' || 
           filtros.microregiao !== 'todas' ||
           filtros.fazenda !== 'todas' || 
           filtros.cidade !== 'todas';
  };

  // Função auxiliar para filtrar produtores baseado nos filtros ativos
  const filtrarProdutores = (produtores) => {
    if (!produtores) return [];
    
    let resultado = [...produtores];

    // Filtro por região
    if (filtros.regiao !== 'todas') {
      resultado = resultado.filter(p => p.regiao === filtros.regiao);
    }

    // Filtro por microregião
    if (filtros.microregiao !== 'todas') {
      resultado = resultado.filter(p => p.microregiao === filtros.microregiao);
    }

    // Filtro por cidade
    if (filtros.cidade !== 'todas') {
      resultado = resultado.filter(p => p.cidade === filtros.cidade);
    }

    // Filtro por fazenda específica (produtor)
    if (filtros.fazenda !== 'todas' && filtros.produtorId) {
      resultado = resultado.filter(p => p.id === filtros.produtorId);
    }

    return resultado;
  };

  // Função auxiliar para obter IDs dos produtores filtrados
  const getProdutorIdsFiltrados = (produtores) => {
    const produtoresFiltrados = filtrarProdutores(produtores);
    return produtoresFiltrados.map(p => p.id);
  };

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
