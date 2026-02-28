/**
 * Context de Notificações
 * Gerencia notificações in-app (não push)
 */

import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { useAuthState } from '../auth/AuthContext';

const NotificacaoContext = createContext();

const NOTIFICACOES_INICIAIS = [
  {
    id: '1',
    tipo: 'visita',
    titulo: 'Visita Agendada',
    mensagem: 'Nova visita técnica agendada para Fazenda Santa Maria',
    data: new Date().toISOString(),
    lida: false,
    prioridade: 'normal',
    icone: 'calendar-outline',
  },
  {
    id: '2',
    tipo: 'mapa',
    titulo: 'Novo Mapa Disponível',
    mensagem: 'Mapa de fertilidade atualizado para sua propriedade',
    data: new Date(Date.now() - 86400000).toISOString(),
    lida: false,
    prioridade: 'alta',
    icone: 'map-outline',
  },
];

export const useNotificacao = () => {
  const context = useContext(NotificacaoContext);
  if (!context) {
    throw new Error('useNotificacao deve ser usado dentro de NotificacaoProvider');
  }
  return context;
};

export const NotificacaoProvider = ({ children }) => {
  const { user } = useAuthState();
  const prevUserIdRef = useRef(null);

  // Resetar notificações quando o usuário mudar
  useEffect(() => {
    const currentUserId = user?.id || null;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentUserId) {
      console.log('[NotificacaoContext] Usuário mudou, resetando notificações');
      setNotificacoes([...NOTIFICACOES_INICIAIS]);
    }
    prevUserIdRef.current = currentUserId;
  }, [user?.id]);

  const [notificacoes, setNotificacoes] = useState([
    // Exemplos de notificações
    {
      id: '1',
      tipo: 'visita',
      titulo: 'Visita Agendada',
      mensagem: 'Nova visita técnica agendada para Fazenda Santa Maria',
      data: new Date().toISOString(),
      lida: false,
      prioridade: 'normal', // baixa, normal, alta
      icone: 'calendar-outline',
    },
    {
      id: '2',
      tipo: 'mapa',
      titulo: 'Novo Mapa Disponível',
      mensagem: 'Mapa de fertilidade atualizado para sua propriedade',
      data: new Date(Date.now() - 86400000).toISOString(), // 1 dia atrás
      lida: false,
      prioridade: 'alta',
      icone: 'map-outline',
    },
  ]);

  // Adicionar notificação
  const adicionarNotificacao = useCallback((notificacao) => {
    const novaNotificacao = {
      id: Date.now().toString(),
      data: new Date().toISOString(),
      lida: false,
      prioridade: 'normal',
      icone: 'notifications-outline',
      ...notificacao,
    };

    setNotificacoes((prev) => [novaNotificacao, ...prev]);
  }, []);

  // Marcar como lida
  const marcarComoLida = useCallback((id) => {
    setNotificacoes((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, lida: true } : notif
      )
    );
  }, []);

  // Marcar todas como lidas
  const marcarTodasComoLidas = useCallback(() => {
    setNotificacoes((prev) =>
      prev.map((notif) => ({ ...notif, lida: true }))
    );
  }, []);

  // Remover notificação
  const removerNotificacao = useCallback((id) => {
    setNotificacoes((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  // Limpar todas as notificações
  const limparNotificacoes = useCallback(() => {
    setNotificacoes([]);
  }, []);

  // Contar não lidas
  const contarNaoLidas = useCallback(() => {
    return notificacoes.filter((notif) => !notif.lida).length;
  }, [notificacoes]);

  const value = {
    notificacoes,
    adicionarNotificacao,
    marcarComoLida,
    marcarTodasComoLidas,
    removerNotificacao,
    limparNotificacoes,
    contarNaoLidas,
  };

  return (
    <NotificacaoContext.Provider value={value}>
      {children}
    </NotificacaoContext.Provider>
  );
};
