import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFiltros } from '../contexts/FiltroContext';
import { colors, typography, spacing, shadows } from '../theme';

/**
 * FiltroRegional - Componente de filtro regional
 * @param {string} fixedRegiao - Região fixa (para colaborador: mostra como info, não como botão)
 * @param {string[]} microregiaoOptions - Opções de micro-região (para colaborador: sub_regioes)
 */
export default function FiltroRegional({ fixedRegiao, microregiaoOptions }) {
  const {
    filtros,
    regioes,
    microregioes: contextMicroregioes,
    fazendas,
    setRegiao,
    setMicroregiao,
    setFazenda,
    limparFiltros,
    getFiltroAtivo,
    temFiltroAtivo,
  } = useFiltros();

  const [modalVisible, setModalVisible] = useState(false);
  const [tipoModal, setTipoModal] = useState(null); // 'regiao', 'microregiao' ou 'fazenda'

  // Se microregiaoOptions prop fornecida (colaborador), usar ela; senão, usar do contexto
  const microregioesDisponiveis = microregiaoOptions || contextMicroregioes;

  // Para colaborador, filtrar fazendas apenas pelas sub_regioes do colaborador
  const fazendasDisponiveis = microregiaoOptions
    ? fazendas.filter(f => microregiaoOptions.includes(f.microregiao))
    : fazendas;

  // Para a modal de fazenda no modo colaborador, agrupar por proprietário
  const fazendasAgrupadas = (() => {
    const grupos = {};
    fazendasDisponiveis.forEach(f => {
      const key = f.produtor; // nome do proprietário
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(f);
    });
    return grupos;
  })();

  const abrirModal = (tipo) => {
    // Se região é fixa (colaborador), não abre o modal de região
    if (tipo === 'regiao' && fixedRegiao) return;
    setTipoModal(tipo);
    setModalVisible(true);
  };

  const fecharModal = () => {
    setModalVisible(false);
    setTipoModal(null);
  };

  const selecionarRegiao = (regiao) => {
    setRegiao(regiao);
    fecharModal();
  };

  const selecionarMicroregiao = (microregiao) => {
    setMicroregiao(microregiao);
    fecharModal();
  };

  const selecionarFazenda = (fazenda) => {
    if (fazenda === 'todas') {
      setFazenda('todas', null);
    } else {
      setFazenda(fazenda.nome, fazenda.id);
    }
    fecharModal();
  };

  const getTextoRegiao = () => {
    if (fixedRegiao) return fixedRegiao;
    if (filtros.regiao === 'todas') return 'Todas as Regiões';
    return filtros.regiao;
  };

  const getTextoMicroregiao = () => {
    if (filtros.microregiao === 'todas') return 'Todas Micro-regiões';
    return filtros.microregiao;
  };

  const getTextoFazenda = () => {
    if (filtros.fazenda === 'todas') return 'Todas as Fazendas';
    return filtros.fazenda;
  };

  const getTituloModal = () => {
    if (tipoModal === 'regiao') return 'Selecionar Região';
    if (tipoModal === 'microregiao') return 'Selecionar Micro-região';
    return 'Selecionar Fazenda / Propriedade';
  };

  // Verificar se colaborador tem filtro ativo (ignora a região fixa)
  const temFiltroAtivoColaborador = () => {
    return filtros.microregiao !== 'todas' || filtros.fazenda !== 'todas';
  };

  const handleLimpar = () => {
    limparFiltros();
    if (fixedRegiao) {
      setTimeout(() => setRegiao(fixedRegiao), 50);
    }
  };

  return (
    <View style={styles.container}>
      {/* === MODO COLABORADOR === */}
      {fixedRegiao ? (
        <>
          {/* Info da região (não clicável) */}
          <View style={styles.regiaoInfoContainer}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.regiaoInfoText}>Região: {fixedRegiao}</Text>
          </View>

          {/* Filtros: Micro-região + Fazenda */}
          <View style={styles.filtrosRow}>
            {/* Filtro Micro-região */}
            <TouchableOpacity 
              style={[
                styles.filtroButton, 
                filtros.microregiao !== 'todas' && styles.filtroButtonAtivo
              ]}
              onPress={() => abrirModal('microregiao')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="map-outline" 
                size={18} 
                color={filtros.microregiao !== 'todas' ? colors.white : colors.primary} 
              />
              <Text 
                style={[
                  styles.filtroText,
                  filtros.microregiao !== 'todas' && styles.filtroTextAtivo
                ]}
                numberOfLines={1}
              >
                {getTextoMicroregiao()}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={filtros.microregiao !== 'todas' ? colors.white : colors.primary} 
              />
            </TouchableOpacity>

            {/* Filtro Fazenda */}
            <TouchableOpacity 
              style={[
                styles.filtroButton,
                filtros.fazenda !== 'todas' && styles.filtroButtonAtivo
              ]}
              onPress={() => abrirModal('fazenda')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="home-outline" 
                size={18} 
                color={filtros.fazenda !== 'todas' ? colors.white : colors.primary} 
              />
              <Text 
                style={[
                  styles.filtroText,
                  filtros.fazenda !== 'todas' && styles.filtroTextAtivo
                ]}
                numberOfLines={1}
              >
                {getTextoFazenda()}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={filtros.fazenda !== 'todas' ? colors.white : colors.primary} 
              />
            </TouchableOpacity>

            {/* Botão Limpar */}
            {temFiltroAtivoColaborador() && (
              <TouchableOpacity 
                style={styles.limparButton}
                onPress={handleLimpar}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>

          {/* Indicador */}
          {temFiltroAtivoColaborador() && (
            <View style={styles.indicadorContainer}>
              <Ionicons name="funnel" size={13} color={colors.primary} />
              <Text style={[styles.indicadorText, styles.indicadorTextAtivo]}>
                Filtrado: {filtros.microregiao !== 'todas' ? filtros.microregiao : ''}{filtros.microregiao !== 'todas' && filtros.fazenda !== 'todas' ? ' • ' : ''}{filtros.fazenda !== 'todas' ? filtros.fazenda : ''}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Filtrado</Text>
              </View>
            </View>
          )}
        </>
      ) : (
        /* === MODO ADMIN === */
        <>
          {/* Título */}
          <View style={styles.tituloContainer}>
            <Ionicons name="filter" size={16} color={colors.textLight} />
            <Text style={styles.titulo}>Selecione a Região e/ou Fazenda</Text>
          </View>

          {/* Filtros - Primeira linha: Região + Micro-região */}
          <View style={styles.filtrosRow}>
            {/* Filtro Região */}
            <TouchableOpacity 
              style={[
                styles.filtroButton, 
                filtros.regiao !== 'todas' && styles.filtroButtonAtivo,
              ]}
              onPress={() => abrirModal('regiao')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="location-outline" 
                size={18} 
                color={filtros.regiao !== 'todas' ? colors.white : colors.primary} 
              />
              <Text 
                style={[
                  styles.filtroText,
                  filtros.regiao !== 'todas' && styles.filtroTextAtivo
                ]}
                numberOfLines={1}
              >
                {getTextoRegiao()}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={filtros.regiao !== 'todas' ? colors.white : colors.primary} 
              />
            </TouchableOpacity>

            {/* Filtro Micro-região */}
            <TouchableOpacity 
              style={[
                styles.filtroButton, 
                filtros.microregiao !== 'todas' && styles.filtroButtonAtivo
              ]}
              onPress={() => abrirModal('microregiao')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="map-outline" 
                size={18} 
                color={filtros.microregiao !== 'todas' ? colors.white : colors.primary} 
              />
              <Text 
                style={[
                  styles.filtroText,
                  filtros.microregiao !== 'todas' && styles.filtroTextAtivo
                ]}
                numberOfLines={1}
              >
                {getTextoMicroregiao()}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={filtros.microregiao !== 'todas' ? colors.white : colors.primary} 
              />
            </TouchableOpacity>
          </View>

          {/* Filtros - Segunda linha: Fazenda + Limpar */}
          <View style={[styles.filtrosRow, { marginTop: spacing.xs }]}>
            {/* Filtro Fazenda */}
            <TouchableOpacity 
              style={[
                styles.filtroButton,
                filtros.fazenda !== 'todas' && styles.filtroButtonAtivo
              ]}
              onPress={() => abrirModal('fazenda')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="home-outline" 
                size={18} 
                color={filtros.fazenda !== 'todas' ? colors.white : colors.primary} 
              />
              <Text 
                style={[
                  styles.filtroText,
                  filtros.fazenda !== 'todas' && styles.filtroTextAtivo
                ]}
                numberOfLines={1}
              >
                {getTextoFazenda()}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={filtros.fazenda !== 'todas' ? colors.white : colors.primary} 
              />
            </TouchableOpacity>

            {/* Botão Limpar */}
            {temFiltroAtivo() && (
              <TouchableOpacity 
                style={styles.limparButton}
                onPress={handleLimpar}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>

          {/* Indicador de Filtro Ativo */}
          <View style={styles.indicadorContainer}>
            <Ionicons 
              name={temFiltroAtivo() ? 'funnel' : 'earth'} 
              size={13} 
              color={temFiltroAtivo() ? colors.primary : colors.textLight} 
            />
            <Text style={[
              styles.indicadorText,
              temFiltroAtivo() && styles.indicadorTextAtivo
            ]}>
              Visualizando: {getFiltroAtivo()}
            </Text>
            {temFiltroAtivo() && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Filtrado</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Modal de Seleção */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={fecharModal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {getTituloModal()}
              </Text>
              <TouchableOpacity onPress={fecharModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {/* === MODAL REGIÃO === */}
              {tipoModal === 'regiao' && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      filtros.regiao === 'todas' && styles.modalItemSelecionado
                    ]}
                    onPress={() => selecionarRegiao('todas')}
                  >
                    <Ionicons 
                      name="earth" 
                      size={20} 
                      color={filtros.regiao === 'todas' ? colors.white : colors.textLight} 
                    />
                    <Text style={[
                      styles.modalItemText,
                      filtros.regiao === 'todas' && styles.modalItemTextSelecionado
                    ]}>
                      Todas as Regiões
                    </Text>
                    {filtros.regiao === 'todas' && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    )}
                  </TouchableOpacity>

                  {regioes.map((regiao) => (
                    <TouchableOpacity
                      key={regiao}
                      style={[
                        styles.modalItem,
                        filtros.regiao === regiao && styles.modalItemSelecionado
                      ]}
                      onPress={() => selecionarRegiao(regiao)}
                    >
                      <Ionicons 
                        name="location" 
                        size={20} 
                        color={filtros.regiao === regiao ? colors.white : colors.textLight} 
                      />
                      <Text style={[
                        styles.modalItemText,
                        filtros.regiao === regiao && styles.modalItemTextSelecionado
                      ]}>
                        {regiao}
                      </Text>
                      {filtros.regiao === regiao && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* === MODAL MICRO-REGIÃO === */}
              {tipoModal === 'microregiao' && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      filtros.microregiao === 'todas' && styles.modalItemSelecionado
                    ]}
                    onPress={() => selecionarMicroregiao('todas')}
                  >
                    <Ionicons 
                      name="globe-outline" 
                      size={20} 
                      color={filtros.microregiao === 'todas' ? colors.white : colors.textLight} 
                    />
                    <Text style={[
                      styles.modalItemText,
                      filtros.microregiao === 'todas' && styles.modalItemTextSelecionado
                    ]}>
                      Todas as Micro-regiões
                    </Text>
                    {filtros.microregiao === 'todas' && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    )}
                  </TouchableOpacity>

                  {microregioesDisponiveis.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="alert-circle-outline" size={32} color={colors.textLight} />
                      <Text style={styles.emptyText}>
                        Nenhuma micro-região disponível
                      </Text>
                    </View>
                  ) : (
                    microregioesDisponiveis.map((micro) => (
                      <TouchableOpacity
                        key={micro}
                        style={[
                          styles.modalItem,
                          filtros.microregiao === micro && styles.modalItemSelecionado
                        ]}
                        onPress={() => selecionarMicroregiao(micro)}
                      >
                        <Ionicons 
                          name="map" 
                          size={20} 
                          color={filtros.microregiao === micro ? colors.white : colors.textLight} 
                        />
                        <Text style={[
                          styles.modalItemText,
                          filtros.microregiao === micro && styles.modalItemTextSelecionado
                        ]}>
                          {micro}
                        </Text>
                        {filtros.microregiao === micro && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </>
              )}

              {/* === MODAL FAZENDA === */}
              {tipoModal === 'fazenda' && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      filtros.fazenda === 'todas' && styles.modalItemSelecionado
                    ]}
                    onPress={() => selecionarFazenda('todas')}
                  >
                    <Ionicons 
                      name="apps" 
                      size={20} 
                      color={filtros.fazenda === 'todas' ? colors.white : colors.textLight} 
                    />
                    <Text style={[
                      styles.modalItemText,
                      filtros.fazenda === 'todas' && styles.modalItemTextSelecionado
                    ]}>
                      Todas as Fazendas
                    </Text>
                    {filtros.fazenda === 'todas' && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    )}
                  </TouchableOpacity>

                  {fazendasDisponiveis.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="alert-circle-outline" size={32} color={colors.textLight} />
                      <Text style={styles.emptyText}>
                        {filtros.regiao !== 'todas' 
                          ? 'Nenhuma fazenda encontrada nesta região'
                          : 'Nenhuma fazenda cadastrada'
                        }
                      </Text>
                    </View>
                  ) : (
                    Object.entries(fazendasAgrupadas).map(([proprietario, fazsProp]) => (
                      <View key={proprietario}>
                        {/* Cabeçalho do proprietário */}
                        <View style={styles.proprietarioHeader}>
                          <Ionicons name="person-outline" size={14} color={colors.textLight} />
                          <Text style={styles.proprietarioText}>{proprietario}</Text>
                          <Text style={styles.proprietarioCount}>
                            {fazsProp.length} {fazsProp.length === 1 ? 'propriedade' : 'propriedades'}
                          </Text>
                        </View>
                        {/* Fazendas do proprietário */}
                        {fazsProp.map((fazenda) => (
                          <TouchableOpacity
                            key={fazenda.id}
                            style={[
                              styles.modalItem,
                              styles.fazendaItem,
                              filtros.produtorId === fazenda.id && styles.modalItemSelecionado
                            ]}
                            onPress={() => selecionarFazenda(fazenda)}
                          >
                            <Ionicons 
                              name="home" 
                              size={20} 
                              color={filtros.produtorId === fazenda.id ? colors.white : colors.textLight} 
                            />
                            <View style={styles.fazendaInfo}>
                              <Text style={[
                                styles.modalItemText,
                                filtros.produtorId === fazenda.id && styles.modalItemTextSelecionado
                              ]}>
                                {fazenda.nome}
                              </Text>
                              <Text style={[
                                styles.fazendaSubtext,
                                filtros.produtorId === fazenda.id && styles.fazendaSubtextSelecionado
                              ]}>
                                {fazenda.microregiao === fazenda.cidade
                                  ? fazenda.cidade
                                  : `${fazenda.microregiao} • ${fazenda.cidade}`}
                              </Text>
                            </View>
                            {filtros.produtorId === fazenda.id && (
                              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    ...shadows.sm,
  },
  regiaoInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: '#e8f5e8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  regiaoInfoText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  tituloContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  titulo: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '600',
  },
  filtrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  filtroButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 6,
    minHeight: 40,
  },
  filtroButtonAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filtroText: {
    fontSize: 13,
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  filtroTextAtivo: {
    color: colors.white,
    fontWeight: '700',
  },
  limparButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 2,
  },
  indicadorText: {
    fontSize: 12,
    color: colors.textLight,
    flex: 1,
    fontWeight: '500',
  },
  indicadorTextAtivo: {
    color: colors.primary,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalList: {
    padding: spacing.sm,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xs,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  modalItemSelecionado: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  modalItemText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  modalItemTextSelecionado: {
    color: colors.white,
    fontWeight: '700',
  },
  proprietarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: 6,
  },
  proprietarioText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  proprietarioCount: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '500',
  },
  fazendaItem: {
    marginLeft: 8,
  },
  fazendaInfo: {
    flex: 1,
  },
  fazendaSubtext: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: 2,
  },
  fazendaSubtextSelecionado: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
