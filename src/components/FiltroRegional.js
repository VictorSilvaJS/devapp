import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFiltros } from '../contexts/FiltroContext';
import { colors, typography, spacing, shadows } from '../theme';

export default function FiltroRegional() {
  const {
    filtros,
    regioes,
    fazendas,
    setRegiao,
    setFazenda,
    limparFiltros,
    getFiltroAtivo,
    temFiltroAtivo,
  } = useFiltros();

  const [modalVisible, setModalVisible] = useState(false);
  const [tipoModal, setTipoModal] = useState(null); // 'regiao' ou 'fazenda'

  const abrirModal = (tipo) => {
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

  const selecionarFazenda = (fazenda) => {
    if (fazenda === 'todas') {
      setFazenda('todas', null);
    } else {
      setFazenda(fazenda.nome, fazenda.id);
    }
    fecharModal();
  };

  const getTextoRegiao = () => {
    if (filtros.regiao === 'todas') return 'Todas as Regiões';
    return filtros.regiao;
  };

  const getTextoFazenda = () => {
    if (filtros.fazenda === 'todas') return 'Todas as Fazendas';
    return filtros.fazenda;
  };

  return (
    <View style={styles.container}>
      {/* Título */}
      <View style={styles.tituloContainer}>
        <Ionicons name="filter" size={16} color={colors.textLight} />
        <Text style={styles.titulo}>Selecione a Região e/ou Fazenda</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtrosRow}>
        {/* Filtro Região */}
        <TouchableOpacity 
          style={[
            styles.filtroButton, 
            filtros.regiao !== 'todas' && styles.filtroButtonAtivo
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
            onPress={limparFiltros}
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
                {tipoModal === 'regiao' ? 'Selecionar Região' : 'Selecionar Fazenda'}
              </Text>
              <TouchableOpacity onPress={fecharModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {tipoModal === 'regiao' && (
                <>
                  {/* Opção "Todas" */}
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

                  {/* Lista de Regiões */}
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

              {tipoModal === 'fazenda' && (
                <>
                  {/* Opção "Todas" */}
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

                  {/* Lista de Fazendas */}
                  {fazendas.length === 0 ? (
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
                    fazendas.map((fazenda) => (
                      <TouchableOpacity
                        key={fazenda.id}
                        style={[
                          styles.modalItem,
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
                            {fazenda.produtor} • {fazenda.cidade}
                          </Text>
                        </View>
                        {filtros.produtorId === fazenda.id && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                        )}
                      </TouchableOpacity>
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
