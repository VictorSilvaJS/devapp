import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, LayoutAnimation, Platform, UIManager, ScrollView } from 'react-native';
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

const smokeRoutes = [
  {
    id: 'S-01',
    label: 'NovaVisita',
    description: 'Produtor tenta criar visita por rota direta',
    route: 'NovaVisita',
  },
  {
    id: 'S-02',
    label: 'EditarVisita v1',
    description: 'Produtor tenta editar visita por rota direta',
    route: 'EditarVisita',
    params: { visitaId: 'v1' },
  },
  {
    id: 'S-03',
    label: 'CadernoDetail c3',
    description: 'Produtor tenta abrir caderno restrito',
    route: 'CadernoDetail',
    params: { cadernoId: 'c3' },
  },
  {
    id: 'S-04',
    label: 'EditarCaderno c1',
    description: 'Produtor tenta editar registro de outro autor',
    route: 'EditarCaderno',
    params: { cadernoId: 'c1' },
  },
  {
    id: 'S-05',
    label: 'VisitaDetail v8',
    description: 'Colaborador tenta abrir visita fora do escopo',
    route: 'VisitaDetail',
    params: { visitaId: 'v8' },
  },
  {
    id: 'S-06',
    label: 'EditarVisita v8',
    description: 'Colaborador tenta editar visita fora do escopo',
    route: 'EditarVisita',
    params: { visitaId: 'v8' },
  },
  {
    id: 'S-07',
    label: 'CadernoDetail c9',
    description: 'Colaborador tenta abrir caderno fora do escopo',
    route: 'CadernoDetail',
    params: { cadernoId: 'c9' },
  },
  {
    id: 'S-08',
    label: 'CadernoDetail c6',
    description: 'Produtor tenta abrir caderno de outra propriedade',
    route: 'CadernoDetail',
    params: { cadernoId: 'c6' },
  },
  {
    id: 'S-09',
    label: 'CadernoDetail c3',
    description: 'Admin abre caderno restrito ao produtor',
    route: 'CadernoDetail',
    params: { cadernoId: 'c3' },
  },
  {
    id: 'S-10',
    label: 'CadernoDetail c7',
    description: 'Colaborador abre caderno dentro do escopo',
    route: 'CadernoDetail',
    params: { cadernoId: 'c7' },
  },
  {
    id: 'S-11',
    label: 'EditarVisita v1',
    description: 'Admin edita visita e confere propriedade travada',
    route: 'EditarVisita',
    params: { visitaId: 'v1' },
  },
  {
    id: 'S-12',
    label: 'EditarCaderno c1',
    description: 'Admin edita caderno e confere propriedade travada',
    route: 'EditarCaderno',
    params: { cadernoId: 'c1' },
  },
  {
    id: 'S-13',
    label: 'EditarCaderno c7',
    description: 'Colaborador edita caderno dentro do escopo',
    route: 'EditarCaderno',
    params: { cadernoId: 'c7' },
  },
  {
    id: 'S-15/S-16',
    label: 'NovaVisita',
    description: 'Admin/colaborador cria visita em propriedade autorizada',
    route: 'NovaVisita',
  },
  {
    id: 'S-17',
    label: 'NovoCaderno',
    description: 'Admin cria caderno pela listagem',
    route: 'NovoCaderno',
  },
  {
    id: 'S-18',
    label: 'NovoCaderno p1',
    description: 'Produtor cria caderno na própria propriedade',
    route: 'NovoCaderno',
    params: { fazendaId: 'p1' },
  },
  {
    id: 'S-19',
    label: 'NovoCaderno p3',
    description: 'Produtor tenta criar caderno em propriedade de outro titular',
    route: 'NovoCaderno',
    params: { fazendaId: 'p3' },
  },
  {
    id: 'S-20/S-22',
    label: 'Propriedade p1',
    description: 'Admin abre detalhe da propriedade para testar aba Caderno e novo registro',
    route: 'ProdutorDetail',
    params: { id: 'p1' },
  },
  {
    id: 'S-21/S-23',
    label: 'Propriedade p4',
    description: 'Colaborador abre propriedade do escopo para testar aba Caderno e novo registro',
    route: 'ProdutorDetail',
    params: { id: 'p4' },
  },
  {
    id: 'S-24',
    label: 'Propriedade p1',
    description: 'Produtor abre própria propriedade e confere aba Caderno visível',
    route: 'ProdutorDetail',
    params: { id: 'p1' },
  },
  {
    id: 'S-30',
    label: 'VisitaDetail v1',
    description: 'Produtor abre detalhe de visita própria',
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
  const insets = useSafeAreaInsets();
  const perfilLabel = user?.perfil ? user.perfil.charAt(0).toUpperCase() + user.perfil.slice(1) : '-';

  useEffect(() => {
    console.log('[PerfilScreen] mounted');
    return () => console.log('[PerfilScreen] unmounted');
  }, []);

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
            <UserProfile user={user} size="large" showDetails={true} />
          </SectionCard>

          <SectionCard title="Informações" icon="person-circle-outline">
            {user?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>E-mail</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Perfil</Text>
              <Text style={styles.infoValue}>{perfilLabel}</Text>
            </View>
            {user?.telefone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefone</Text>
                <Text style={styles.infoValue}>{user.telefone}</Text>
              </View>
            )}
            {user?.regiao && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Região</Text>
                <Text style={styles.infoValue}>{user.regiao}</Text>
              </View>
            )}
          </SectionCard>

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
              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() => navigation.navigate('EditProfile')}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={18} color={colors.white} />
                <Text style={styles.actionBtnText}>Editar Perfil</Text>
              </TouchableOpacity>

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
    fontSize: typography.fontBody,
    color: colors.text,
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
