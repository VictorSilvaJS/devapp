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

const smokeRoutes = [
  {
    id: 'S-01',
    label: 'NovaVisita',
    description: 'Teste de criação de visita por rota direta',
    route: 'NovaVisita',
  },
  {
    id: 'S-02',
    label: 'EditarVisita v1',
    description: 'Teste de edição de visita por rota direta',
    route: 'EditarVisita',
    params: { visitaId: 'v1' },
  },
  {
    id: 'S-03',
    label: 'CadernoDetail c3',
    description: 'Teste de abertura de caderno restrito',
    route: 'CadernoDetail',
    params: { cadernoId: 'c3' },
  },
  {
    id: 'S-04',
    label: 'EditarCaderno c1',
    description: 'Teste de edição de registro de outro autor',
    route: 'EditarCaderno',
    params: { cadernoId: 'c1' },
  },
  {
    id: 'S-05',
    label: 'VisitaDetail v8',
    description: 'Teste de abertura de visita fora do escopo',
    route: 'VisitaDetail',
    params: { visitaId: 'v8' },
  },
  {
    id: 'S-06',
    label: 'EditarVisita v8',
    description: 'Teste de edição de visita fora do escopo',
    route: 'EditarVisita',
    params: { visitaId: 'v8' },
  },
  {
    id: 'S-07',
    label: 'CadernoDetail c9',
    description: 'Teste de abertura de caderno fora do escopo',
    route: 'CadernoDetail',
    params: { cadernoId: 'c9' },
  },
  {
    id: 'S-08',
    label: 'CadernoDetail c6',
    description: 'Teste de abertura de caderno de outra propriedade',
    route: 'CadernoDetail',
    params: { cadernoId: 'c6' },
  },
  {
    id: 'S-09',
    label: 'CadernoDetail c3',
    description: 'Teste de abertura de caderno restrito',
    route: 'CadernoDetail',
    params: { cadernoId: 'c3' },
  },
  {
    id: 'S-10',
    label: 'CadernoDetail c7',
    description: 'Teste de abertura de caderno dentro do escopo',
    route: 'CadernoDetail',
    params: { cadernoId: 'c7' },
  },
  {
    id: 'S-11',
    label: 'EditarVisita v1',
    description: 'Teste de edição de visita com propriedade travada',
    route: 'EditarVisita',
    params: { visitaId: 'v1' },
  },
  {
    id: 'S-12',
    label: 'EditarCaderno c1',
    description: 'Teste de edição de caderno com propriedade travada',
    route: 'EditarCaderno',
    params: { cadernoId: 'c1' },
  },
  {
    id: 'S-13',
    label: 'EditarCaderno c7',
    description: 'Teste de edição de caderno dentro do escopo',
    route: 'EditarCaderno',
    params: { cadernoId: 'c7' },
  },
  {
    id: 'S-15/S-16',
    label: 'NovaVisita',
    description: 'Teste de criação de visita em propriedade autorizada',
    route: 'NovaVisita',
  },
  {
    id: 'S-17',
    label: 'NovoCaderno',
    description: 'Teste de criação de caderno pela listagem',
    route: 'NovoCaderno',
  },
  {
    id: 'S-18',
    label: 'NovoCaderno p1',
    description: 'Teste de criação de caderno na propriedade vinculada',
    route: 'NovoCaderno',
    params: { fazendaId: 'p1' },
  },
  {
    id: 'S-19',
    label: 'NovoCaderno p3',
    description: 'Teste de criação de caderno em propriedade de outro titular',
    route: 'NovoCaderno',
    params: { fazendaId: 'p3' },
  },
  {
    id: 'S-20/S-22',
    label: 'Propriedade p1',
    description: 'Teste de detalhe da propriedade com aba Caderno e novo registro',
    route: 'ProdutorDetail',
    params: { id: 'p1' },
  },
  {
    id: 'S-21/S-23',
    label: 'Propriedade p4',
    description: 'Teste de propriedade do escopo com aba Caderno e novo registro',
    route: 'ProdutorDetail',
    params: { id: 'p4' },
  },
  {
    id: 'S-24',
    label: 'Propriedade p1',
    description: 'Teste de propriedade vinculada com aba Caderno visível',
    route: 'ProdutorDetail',
    params: { id: 'p1' },
  },
  {
    id: 'S-30',
    label: 'VisitaDetail v1',
    description: 'Teste de abertura de detalhe de visita vinculada',
    route: 'VisitaDetail',
    params: { visitaId: 'v1' },
  },
];

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

  useEffect(() => {
    console.log('[PerfilScreen] mounted');
    return () => console.log('[PerfilScreen] unmounted');
  }, []);

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
                variant="warning"
                message="O cadastro local ainda mistura Regional/Área operacional e Município/UF. Estes vínculos são somente leitura. Solicite correção ao administrador responsável."
                style={styles.infoBoxInline}
              />
            </SectionCard>
          )}

          <View style={styles.actionsSection}>
            {__DEV__ && (
              <SectionCard
                title="Smoke Dev"
                icon="construct-outline"
                contentStyle={styles.devSmokeContent}
              >
                <InfoBox
                  message="Atalhos temporários para testar rotas diretas."
                  style={styles.infoBox}
                />
                {smokeRoutes.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.devSmokeBtn}
                    onPress={() => navigation.navigate(item.route, item.params)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.devSmokeTextGroup}>
                      <Text style={styles.devSmokeBtnText}>{item.id} - {item.label}</Text>
                      <Text style={styles.devSmokeDescription}>{item.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </SectionCard>
            )}

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
  devSmokeContent: {
    gap: spacing.sm,
  },
  devSmokeBtn: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    padding: spacing.md
  },
  devSmokeTextGroup: {
    gap: 3
  },
  devSmokeBtnText: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold
  },
  devSmokeDescription: {
    color: colors.muted,
    fontSize: typography.fontSmall
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
