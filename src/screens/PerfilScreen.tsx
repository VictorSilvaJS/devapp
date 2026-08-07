import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, LayoutAnimation, ScrollView, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthState, useAuthActions } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { useToast } from '../components/Toast';
import { colors, typography, spacing, shadows } from '../theme';
import UserProfile from '../components/UserProfile';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import { Produtor, User } from '../api/mock';
import { normalizeNome } from '../domain';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import { buildSolicitacaoAtualizacaoCadastral } from '../utils/perfilProdutorCompat';
import {
  getPropriedadesDoColaborador,
  getPropriedadesDoUsuarioProdutor,
  getUsuarioStatusInfo,
} from '../utils/usuarioAdminCompat';

export default function PerfilScreen({ navigation }) {
  const { user } = useAuthState();
  const { logout } = useAuthActions();
  const { limparFiltros } = useFiltros();
  const { limparNotificacoes } = useNotificacao();
  const toast = useToast();
  const [showLogout, setShowLogout] = useState(false);
  const [usuarioDetalhado, setUsuarioDetalhado] = useState<any>(null);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const insets = useSafeAreaInsets();

  const loadProfileData = useCallback(async () => {
    if (!user) return;

    try {
      const [propriedadesData, usuarioData] = await Promise.all([
        Produtor.list(),
        user.id ? User.get(user.id).catch(() => null) : Promise.resolve(null),
      ]);
      setPropriedades(propriedadesData as any[]);
      setUsuarioDetalhado(usuarioData ? { ...usuarioData, ...user } : user);
    } catch (error) {
      console.warn('Não foi possível carregar dados complementares do perfil:', error);
      setUsuarioDetalhado(user);
    }
  }, [user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const usuarioPerfil = usuarioDetalhado || user || {};
  const nome = normalizeNome(usuarioPerfil) || 'Usuário';
  const telefone = usuarioPerfil.telefone || usuarioPerfil.phone || '';
  const documento = usuarioPerfil.documento || usuarioPerfil.cpf || usuarioPerfil.cnpj || '';
  const status = getUsuarioStatusInfo(usuarioPerfil);
  const propriedadesProdutor = useMemo(
    () => getPropriedadesDoUsuarioProdutor(usuarioPerfil, propriedades),
    [usuarioPerfil, propriedades]
  );
  const propriedadesColaborador = useMemo(
    () => getPropriedadesDoColaborador(usuarioPerfil, propriedades),
    [usuarioPerfil, propriedades]
  );
  const propriedadesVisiveis =
    usuarioPerfil.perfil === 'produtor' ? propriedadesProdutor : propriedadesColaborador;

  const handleLogoutConfirm = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      // Limpar estados dos contextos antes do logout
      limparFiltros();
      limparNotificacoes();
      await logout();
      toast.showSuccess('Logout realizado');
      navigation.replace('Login');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const handleAbrirPropriedade = (propriedade) => {
    const params = buildPropriedadeDetailRouteParams(propriedade);
    if (params) {
      navigation.navigate('ProdutorDetail', params);
    }
  };

  const handleSolicitarAtualizacaoCadastral = async () => {
    const message = buildSolicitacaoAtualizacaoCadastral({
      produtorNome: nome,
      propriedades: propriedadesVisiveis.map(
        (propriedade) => getFazendaUiInfo(propriedade).fazendaNome
      ),
    });

    try {
      await Share.share({
        title: 'Solicitar atualização cadastral',
        message,
      });
    } catch (error) {
      toast.showError('Não foi possível preparar a solicitação');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: spacing.screen + insets.top }]}>
          <SectionCard style={styles.profileSection} contentStyle={styles.profileContent}>
            <UserProfile user={usuarioPerfil} size="large" showDetails={true} showPerfilBadge={false} />
          </SectionCard>

          <SectionCard title="Dados cadastrais" icon="person-circle-outline">
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nome</Text>
              <Text style={styles.infoValue}>{nome}</Text>
            </View>
            {usuarioPerfil?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>E-mail</Text>
                <Text style={styles.infoValue}>{usuarioPerfil.email}</Text>
              </View>
            )}
            {telefone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefone</Text>
                <Text style={styles.infoValue}>{telefone}</Text>
              </View>
            ) : null}
            {documento ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Documento</Text>
                <Text style={styles.infoValue}>{documento}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{status.label}</Text>
            </View>
            {usuarioPerfil?.observacoes ? (
              <InfoBox message={usuarioPerfil.observacoes} style={styles.infoBoxInline} />
            ) : null}
          </SectionCard>

          {usuarioPerfil.perfil === 'produtor' && (
            <SectionCard
              title="Minhas Propriedades"
              icon="business-outline"
              subtitle={propriedadesVisiveis.length > 0 ? 'Propriedades vinculadas ao seu perfil.' : 'Nenhuma propriedade vinculada.'}
            >
              {propriedadesVisiveis.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma propriedade vinculada</Text>
              ) : (
                propriedadesVisiveis.map((propriedade) => {
                  const info = getFazendaUiInfo(propriedade);
                  return (
                    <TouchableOpacity
                      key={info.id}
                      style={[styles.propertyRow, styles.propertyRowAction]}
                      onPress={() => handleAbrirPropriedade(propriedade)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${info.fazendaNome || 'Propriedade sem nome'}`}
                    >
                      <Ionicons name="home-outline" size={18} color={colors.primary} />
                      <View style={styles.propertyText}>
                        <Text style={styles.propertyTitle}>{info.fazendaNome || 'Propriedade sem nome'}</Text>
                        <Text style={styles.propertySubtitle}>
                          {info.localizacao || 'Localização não informada'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  );
                })
              )}
              <InfoBox
                message="Se algum dado estiver incorreto, prepare uma solicitação para a equipe responsável. A alteração não é feita diretamente pelo Perfil."
                style={styles.infoBoxInline}
              />
              <TouchableOpacity
                style={styles.requestUpdateButton}
                onPress={handleSolicitarAtualizacaoCadastral}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Solicitar atualização cadastral"
              >
                <Ionicons name="share-social-outline" size={18} color={colors.white} />
                <Text style={styles.requestUpdateButtonText}>Solicitar atualização cadastral</Text>
              </TouchableOpacity>
            </SectionCard>
          )}

          {usuarioPerfil.perfil === 'colaborador' && (
            <SectionCard
              title="Escopo operacional"
              icon="link-outline"
              subtitle="Acesso definido somente pelas Propriedades vinculadas diretamente."
            >
              <InfoBox
                message="Município e UF servem para localização e filtros; não concedem acesso."
                style={styles.infoBoxInline}
              />

              <Text style={styles.subsectionTitle}>Propriedades vinculadas diretamente</Text>
              {propriedadesVisiveis.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma propriedade atribuída</Text>
              ) : (
                propriedadesVisiveis.map((propriedade) => {
                  const info = getFazendaUiInfo(propriedade);
                  return (
                    <View key={info.id} style={styles.propertyRow}>
                      <Ionicons name="home-outline" size={18} color={colors.primary} />
                      <View style={styles.propertyText}>
                        <Text style={styles.propertyTitle}>{info.fazendaNome || 'Propriedade sem nome'}</Text>
                        <Text style={styles.propertySubtitle}>
                          {info.localizacao || 'Localização não informada'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              <InfoBox
                message="A inclusão ou remoção de uma Propriedade neste escopo deve ser feita pelo administrador por vínculo direto."
                style={styles.infoBoxInline}
              />
            </SectionCard>
          )}

          <View style={styles.actionsSection}>
            <SectionCard title="Ações" icon="settings-outline" contentStyle={styles.actionsCardContent}>
              {usuarioPerfil.perfil !== 'produtor' ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => navigation.navigate('EditProfile')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={18} color={colors.white} />
                  <Text style={styles.actionBtnText}>Editar dados</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.actionBtn, styles.logoutBtn]}
                onPress={() => setShowLogout(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.white} />
                <Text style={[styles.actionBtnText, styles.logoutText]}>Sair da Conta</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        </ScrollView>
      </LinearGradient>

      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmação</Text>
            <Text style={styles.modalBody}>Deseja realmente sair da sua conta?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowLogout(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleLogoutConfirm}>
                <Text style={styles.modalConfirmText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  gradient: {
    flex: 1
  },
  content: { 
    padding: spacing.screen,
    paddingBottom: spacing.screen * 2 + 65 // padding extra para não ficar atrás da tab bar
  },
  profileSection: {
    backgroundColor: colors.card,
    padding: spacing.card * 1.5,
    borderRadius: spacing.radiusLg,
    marginBottom: spacing.gap * 1.5,
    alignItems: 'center',
    ...shadows.md
  },
  profileContent: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  infoLabel: {
    fontSize: typography.fontBody,
    color: colors.muted,
    fontWeight: typography.weightSemibold
  },
  infoValue: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightBold,
    textAlign: 'right'
  },
  infoBoxInline: {
    marginTop: spacing.md,
    marginBottom: 0
  },
  subsectionTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  propertyRowAction: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  propertyText: {
    flex: 1,
    minWidth: 0
  },
  propertyTitle: {
    color: colors.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold
  },
  propertySubtitle: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    marginTop: 2
  },
  requestUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius,
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  requestUpdateButtonText: {
    flexShrink: 1,
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.fontBody - 1,
    lineHeight: 20
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  infoChip: {
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border
  },
  infoChipText: {
    color: colors.primary,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold
  },
  actionsSection: {
    gap: spacing.gap
  },
  infoBox: {
    marginBottom: spacing.md
  },
  actionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: 14,
    borderRadius: spacing.radius,
    alignItems: 'center',
    ...shadows.sm
  },
  actionsCardContent: {
    gap: spacing.md,
  },
  editBtn: {
    backgroundColor: colors.primary
  },
  logoutBtn: { 
    backgroundColor: colors.error
  },
  actionBtnText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold
  },
  logoutText: { 
    color: colors.white 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: colors.overlay, 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: spacing.xl
  },
  modalContent: { 
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card, 
    padding: spacing.xl, 
    borderRadius: spacing.radiusLg,
    ...shadows.lg
  },
  modalTitle: { 
    fontSize: typography.fontSubtitle, 
    fontWeight: typography.weightBold, 
    color: colors.text,
    marginBottom: spacing.sm
  },
  modalBody: { 
    fontSize: typography.fontBody,
    color: colors.textLight,
    lineHeight: 22,
    marginBottom: spacing.xl
  },
  modalActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: spacing.md
  },
  modalBtnCancel: { 
    flex: 1,
    paddingVertical: spacing.md + 2, 
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radius,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  modalBtnConfirm: { 
    flex: 1,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radius, 
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  modalCancelText: { 
    color: colors.text,
    fontWeight: typography.weightSemibold,
    fontSize: typography.fontBody
  },
  modalConfirmText: { 
    color: colors.white, 
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody
  }
});
