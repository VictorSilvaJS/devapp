import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import { Produtor, User } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import { colors, shadows, spacing, typography } from '../theme';
import { getFazendaId } from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import {
  buildUsuarioVinculoPrincipal,
  getPropriedadesDoColaborador,
  getPropriedadesDoUsuarioProdutor,
  getPropriedadeIdsAtribuidas,
  getSubRegioesUsuario,
  getUsuarioNome,
  getUsuarioPerfilLabel,
  getUsuarioStatusInfo,
} from '../utils/usuarioAdminCompat';

const perfilIcon = (perfil?: string) => {
  if (perfil === 'admin') return 'shield-checkmark-outline';
  if (perfil === 'colaborador') return 'briefcase-outline';
  return 'leaf-outline';
};

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={18} color={colors.primary} />
    <View style={styles.infoTextWrap}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  </View>
);

const PropertyRow = ({ propriedade, onPress }) => {
  const info = getFazendaUiInfo(propriedade);

  return (
    <TouchableOpacity style={styles.propertyRow} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.propertyIcon}>
        <Ionicons name="home-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.propertyTextWrap}>
        <Text style={styles.propertyTitle} numberOfLines={1}>{info.fazendaNome || 'Propriedade sem nome'}</Text>
        <Text style={styles.propertySubtitle} numberOfLines={1}>
          {[info.titularNome, info.localizacao].filter(Boolean).join(' • ') || 'Contexto não informado'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
};

export default function UsuarioDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuthState();
  const [usuario, setUsuario] = useState<any>(null);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = route.params?.userId || route.params?.id;

  const load = async () => {
    setLoading(true);
    try {
      const [usuarioData, propriedadesData] = await Promise.all([
        User.get(userId),
        Produtor.list(),
      ]);

      setUsuario(usuarioData);
      setPropriedades(propriedadesData as any[]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user?.perfil === 'admin' && userId) {
        load();
      } else {
        setLoading(false);
      }
    }, [user?.perfil, userId])
  );

  if (user?.perfil !== 'admin') {
    return (
      <View style={styles.container}>
        <Header title="Usuário" showBack />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedTitle}>Acesso restrito</Text>
          <Text style={styles.blockedText}>Somente administradores acessam detalhes de usuários no mock.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Usuário" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando usuário...</Text>
        </View>
      </View>
    );
  }

  if (!usuario) {
    return (
      <View style={styles.container}>
        <Header title="Usuário" showBack />
        <View style={styles.blockedContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedTitle}>Usuário não encontrado</Text>
        </View>
      </View>
    );
  }

  const nome = getUsuarioNome(usuario);
  const status = getUsuarioStatusInfo(usuario);
  const vinculo = buildUsuarioVinculoPrincipal(usuario, propriedades);
  const propriedadesProdutor = getPropriedadesDoUsuarioProdutor(usuario, propriedades);
  const propriedadesColaborador = getPropriedadesDoColaborador(usuario, propriedades);
  const propriedadesAtribuidas = getPropriedadeIdsAtribuidas(usuario);
  const subRegioes = getSubRegioesUsuario(usuario);

  return (
    <View style={styles.container}>
      <Header title="Usuário" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{nome.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{nome}</Text>
            <View style={styles.profileBadges}>
              <View style={styles.perfilBadge}>
                <Ionicons name={perfilIcon(usuario.perfil)} size={14} color={colors.primary} />
                <Text style={styles.perfilText}>{getUsuarioPerfilLabel(usuario.perfil)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.ativo ? colors.successBg : colors.errorBgLight }]}>
                <Text style={[styles.statusText, { color: status.ativo ? colors.success : colors.error }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text style={styles.vinculoText}>{vinculo}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados de acesso</Text>
          <InfoRow icon="mail-outline" label="E-mail" value={usuario.email} />
          <InfoRow icon="call-outline" label="Telefone" value={usuario.telefone} />
          <InfoRow icon="person-circle-outline" label="Perfil" value={getUsuarioPerfilLabel(usuario.perfil)} />
          <InfoRow icon="checkmark-circle-outline" label="Status" value={status.label} />
        </View>

        {usuario.perfil === 'produtor' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vínculo do produtor</Text>
            <InfoRow icon="link-outline" label="Tipo de vínculo" value={usuario.tipo_vinculo_produtor || 'Titular/responsável'} />
            <InfoRow icon="key-outline" label="Identificador do titular" value={usuario.produtor_id} />

            <Text style={styles.subsectionTitle}>Propriedades vinculadas</Text>
            {propriedadesProdutor.length === 0 ? (
              <Text style={styles.emptyInline}>Nenhuma propriedade vinculada a este usuário produtor.</Text>
            ) : (
              propriedadesProdutor.map((propriedade) => (
                <PropertyRow
                  key={getFazendaId(propriedade)}
                  propriedade={propriedade}
                  onPress={() => navigation.navigate('ProdutorDetail', { id: getFazendaId(propriedade) })}
                />
              ))
            )}
          </View>
        )}

        {usuario.perfil === 'colaborador' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Escopo do colaborador</Text>
            <InfoRow icon="briefcase-outline" label="Função/cargo" value={usuario.cargo || 'Consultoria regional'} />
            <InfoRow icon="location-outline" label="Região" value={usuario.regiao} />

            <Text style={styles.subsectionTitle}>Micro-regiões atendidas</Text>
            {subRegioes.length === 0 ? (
              <Text style={styles.emptyInline}>Nenhuma micro-região vinculada.</Text>
            ) : (
              <View style={styles.chipWrap}>
                {subRegioes.map((subRegiao) => (
                  <View key={subRegiao} style={styles.infoChip}>
                    <Text style={styles.infoChipText}>{subRegiao}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.subsectionTitle}>
              {propriedadesAtribuidas.length > 0 ? 'Propriedades atribuídas' : 'Propriedades no escopo visual'}
            </Text>
            {propriedadesColaborador.length === 0 ? (
              <Text style={styles.emptyInline}>Nenhuma propriedade encontrada para este escopo.</Text>
            ) : (
              propriedadesColaborador.map((propriedade) => (
                <PropertyRow
                  key={getFazendaId(propriedade)}
                  propriedade={propriedade}
                  onPress={() => navigation.navigate('ProdutorDetail', { id: getFazendaId(propriedade) })}
                />
              ))
            )}
          </View>
        )}

        {usuario.perfil === 'admin' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Administração</Text>
            <InfoRow icon="earth-outline" label="Acesso" value="Global" />
            <InfoRow icon="shield-checkmark-outline" label="Escopo" value={(usuario.regioes_acesso || ['Brasil']).join(', ')} />
            <Text style={styles.emptyInline}>Este perfil representa visão ampla da operação no MVP mockado.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Observações</Text>
          <Text style={styles.observacoes}>{usuario.observacoes || 'Nenhuma observação registrada.'}</Text>
        </View>

        <View style={{ height: spacing.xl * 3 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditarUsuario', { userId: usuario.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={20} color={colors.white} />
          <Text style={styles.editButtonText}>Editar Usuário</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.fontBody,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: typography.fontTitle - 2,
    fontWeight: typography.weightBold,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    marginBottom: spacing.sm,
  },
  profileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  perfilBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: spacing.radiusSm,
  },
  perfilText: {
    color: colors.primary,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: spacing.radiusSm,
  },
  statusText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  vinculoText: {
    color: colors.textLight,
    fontSize: typography.fontBody - 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  propertyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  propertyTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  propertyTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  propertySubtitle: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    marginTop: 2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoChip: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoChipText: {
    color: colors.text,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
  },
  emptyInline: {
    color: colors.muted,
    fontSize: typography.fontBody - 1,
    lineHeight: 20,
  },
  observacoes: {
    color: colors.textLight,
    fontSize: typography.fontBody,
    lineHeight: 22,
  },
  footer: {
    padding: spacing.screen,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md + 2,
  },
  editButtonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  blockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  blockedTitle: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    marginTop: spacing.md,
  },
  blockedText: {
    color: colors.muted,
    fontSize: typography.fontBody,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
