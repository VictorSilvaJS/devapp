import React, { createContext, useContext, useState, useEffect } from 'react';
import { Produtor } from '../api/mock';

const FiltroContext = createContext();

export function FiltroProvider({ children }) {
  const [filtros, setFiltros] = useState({
    regiao: 'todas',
    fazenda: 'todas',
    produtorId: null,
    cidade: 'todas',
  });

  const [regioes, setRegioes] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [cidades, setCidades] = useState([]);

  // Carregar opções de filtro disponíveis
  useEffect(() => {
    loadOpcoesDisponiveis();
  }, []);

  // Atualizar fazendas disponíveis quando região mudar
  useEffect(() => {
    loadFazendas();
  }, [filtros.regiao]);

  const loadOpcoesDisponiveis = async () => {
    try {
      const produtores = await Produtor.list();

      // Extrair regiões únicas
      const regioesUnicas = [...new Set(produtores.map(p => p.regiao).filter(Boolean))].sort();
      setRegioes(regioesUnicas);

      // Extrair cidades únicas
      const cidadesUnicas = [...new Set(produtores.map(p => p.cidade).filter(Boolean))].sort();
      setCidades(cidadesUnicas);

    } catch (error) {
      console.error('Erro ao carregar opções de filtro:', error);
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

      // Extrair fazendas com seus IDs
      const fazendasDisponiveis = produtoresFiltrados
        .filter(p => p.fazenda)
        .map(p => ({
          id: p.id,
          nome: p.fazenda,
          produtor: p.nome,
          cidade: p.cidade,
          regiao: p.regiao,
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
      fazenda: 'todas', // Resetar fazenda ao mudar região
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
      fazenda: 'todas',
      produtorId: null,
      cidade: 'todas',
    });
  };

  const getFiltroAtivo = () => {
    // Se fazenda e região estão selecionadas, mostrar ambas
    if (filtros.fazenda !== 'todas' && filtros.regiao !== 'todas') {
      const fazendaInfo = fazendas.find(f => f.id === filtros.produtorId);
      return fazendaInfo 
        ? `${filtros.regiao} • ${fazendaInfo.nome}` 
        : `${filtros.regiao} • Fazenda Selecionada`;
    }
    // Se apenas fazenda está selecionada
    if (filtros.fazenda !== 'todas') {
      const fazendaInfo = fazendas.find(f => f.id === filtros.produtorId);
      return fazendaInfo ? `${fazendaInfo.nome}` : 'Fazenda Selecionada';
    }
    // Se apenas região está selecionada
    if (filtros.regiao !== 'todas') {
      return `Região ${filtros.regiao}`;
    }
    if (filtros.cidade !== 'todas') {
      return filtros.cidade;
    }
    return 'Todas as Regiões';
  };

  const temFiltroAtivo = () => {
    return filtros.regiao !== 'todas' || 
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
    fazendas,
    cidades,
    setRegiao,
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
