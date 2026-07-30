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
import EmptyState from '../components/EmptyState';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import { Produtor, User } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import { LocalCredentialService } from '../auth/localCredentials';
import { colors, semanticColors, shadows, spacing, typography } from '../theme';
import { getFazendaId } from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import {
  buildUsuarioVinculoPrincipal,
  getNivelAdminLabel,
  getPropriedadesDoColaborador,
  getPropriedadesDoUsuarioProdutor,
  getPropriedadeIdsAtribuidas,
  getUsuarioNome,
  getUsuarioPerfilLabel,
  getUsuarioStatusInfo,
  getVinculoPropriedadeLabel,
  getVinculosMicroregiaoUsuario,
  getVinculosPropriedadeUsuario,
} from '../utils/usuarioAdminCompat';

const perfilIcon = (perfil?: string) => {
  if (perfil === 'admin') return 'shield-checkmark-outline';
  if (perfil === 'colaborador') return 'briefcase-outline';
  return 'leaf-outline';
};

const statusColors = (status: any) => {
  if (status.key === 'ativo') {
    return { bg: semanticColors.success.surface, text: semanticColors.success.text };
  }
  if (status.key === 'pendente') {
    return { bg: semanticColors.warning.surface, text: semanticColors.warning.text };
  }

  return { bg: semanticColors.error.surface, text: semanticColors.error.text };
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

const PropertyRow = ({ propriedade, onPress, vinculo }: any) => {
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
        {vinculo && (
          <Text style={styles.propertyMeta} numberOfLines={1}>
            {vinculo.principal ? 'Principal • ' : ''}{getVinculoPropriedadeLabel(vinculo.tipo_vinculo)}
          </Text>
        )}
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
  const [localAccessConfigured, setLocalAccessConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const userId = route.params?.userId || route.params?.id;

  const load = async () => {
    setLoading(true);
    try {
      const [usuarioData, propriedadesData, hasLocalCredential] = await Promise.all([
        User.get(userId),
        Produtor.list(),
        LocalCredentialService.hasCredential(userId),
      ]);

      setUsuario(usuarioData);
      setPropriedades(propriedadesData as any[]);
      setLocalAccessConfigured(hasLocalCredential);
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
  const statusPalette = statusColors(status);
  const vinculo = buildUsuarioVinculoPrincipal(usuario, propriedades);
  const propriedadesProdutor = getPropriedadesDoUsuarioProdutor(usuario, propriedades);
  const propriedadesColaborador = getPropriedadesDoColaborador(usuario, propriedades);
  const propriedadesAtribuidas = getPropriedadeIdsAtribuidas(usuario);
  const vinculosPropriedades = getVinculosPropriedadeUsuario(usuario, propriedades);
  const vinculosMicroregioes = getVinculosMicroregiaoUsuario(usuario);
  const getVinculoDaPropriedade = (id: string) =>
    vinculosPropriedades.find((item) => item.propriedade_id === id);
  const abrirPropriedade = (propriedade: any) => {
    const params = buildPropriedadeDetailRouteParams(propriedade);
    if (params) {
      navigation.navigate('ProdutorDetail', params);
    }
  };

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
              <View style={[styles.statusBadge, { backgroundColor: statusPalette.bg }]}>
                <Text style={[styles.statusText, { color: statusPalette.text }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text style={styles.vinculoText}>{vinculo}</Text>
          </View>
        </View>

        <InfoBox
          title="Cadastro administrativo demonstrativo"
          message="Este usuário e seus vínculos ficam salvos localmente. A credencial local é preparatória e ainda não integra sessão, backend ou RBAC."
        />

        <SectionCard title="Acesso local" subtitle="Indicador administrativo seguro da credencial neste aparelho.">
          <InfoRow
            icon={localAccessConfigured ? 'key-outline' : 'key-outline'}
            label="Credencial"
            value={localAccessConfigured ? 'Acesso local configurado' : 'Acesso local não configurado'}
          />
          <InfoBox
            message="Nenhum dado sensível da credencial é exibido nesta tela."
            style={styles.inlineInfoBox}
          />
          <TouchableOpacity
            style={styles.localAccessButton}
            onPress={() => navigation.navigate('EditarUsuario', { userId: usuario.id })}
            activeOpacity={0.78}
          >
            <Ionicons
              name={localAccessConfigured ? 'key-outline' : 'add-circle-outline'}
              size={18}
              color={colors.primary}
            />
            <Text style={styles.localAccessButtonText}>
              {localAccessConfigured ? 'Redefinir senha local' : 'Definir senha local'}
            </Text>
          </TouchableOpacity>
        </SectionCard>

        <SectionCard title="Dados do usuário" subtitle="Telefone e documento são opcionais e só aparecem quando informados.">
          <InfoRow icon="mail-outline" label="E-mail" value={usuario.email} />
          {usuario.telefone ? <InfoRow icon="call-outline" label="Telefone" value={usuario.telefone} /> : null}
          {usuario.documento ? <InfoRow icon="document-text-outline" label="Documento" value={usuario.documento} /> : null}
          {!usuario.telefone && !usuario.documento ? (
            <InfoBox
              message="Telefone e documento não informados. Esses campos são opcionais no cadastro demonstrativo."
              style={styles.inlineInfoBox}
            />
          ) : null}
        </SectionCard>

        <SectionCard title="Perfil demonstrativo">
          <InfoRow icon="person-circle-outline" label="Perfil" value={getUsuarioPerfilLabel(usuario.perfil)} />
          <InfoRow icon="checkmark-circle-outline" label="Status" value={status.label} />
        </SectionCard>

        {usuario.perfil === 'produtor' && (
          <SectionCard title="Vínculos do Produtor">
            <InfoBox
              message="Vínculos com Propriedades organizam a demonstração local e não criam login ou permissão real."
              style={styles.inlineInfoBox}
            />
            <InfoRow
              icon="link-outline"
              label="Vínculos registrados"
              value={`${vinculosPropriedades.length} propriedade${vinculosPropriedades.length === 1 ? '' : 's'}`}
            />

            <Text style={styles.subsectionTitle}>Propriedades vinculadas</Text>
            {propriedadesProdutor.length === 0 ? (
              <EmptyState
                icon="home-outline"
                title={status.key === 'pendente' ? 'Vínculo pendente' : 'Nenhuma propriedade vinculada'}
                message={
                  status.key === 'pendente'
                    ? 'Usuário produtor pendente, ainda sem Propriedade vinculada.'
                    : 'Nenhuma Propriedade vinculada a este usuário produtor; produtor ativo deve ter ao menos uma Propriedade no mock.'
                }
                style={styles.emptyStateCompact}
              />
            ) : (
              propriedadesProdutor.map((propriedade) => (
                <PropertyRow
                  key={getFazendaId(propriedade)}
                  propriedade={propriedade}
                  vinculo={getVinculoDaPropriedade(getFazendaId(propriedade))}
                  onPress={() => abrirPropriedade(propriedade)}
                />
              ))
            )}
          </SectionCard>
        )}

        {usuario.perfil === 'colaborador' && (
          <SectionCard title="Escopo do Colaborador">
            <InfoRow icon="briefcase-outline" label="Função/cargo" value={usuario.cargo || 'Consultoria regional'} />
            <InfoRow icon="location-outline" label="Região" value={usuario.regiao} />
            <InfoBox
              message="Região, Microrregião e Propriedades atribuídas automaticamente são vínculos demonstrativos. Eles não são RBAC final e não alteram sozinhos o acesso efetivo."
              style={styles.inlineInfoBox}
            />

            <Text style={styles.subsectionTitle}>Microregiões atendidas</Text>
            {vinculosMicroregioes.length === 0 ? (
              <EmptyState
                icon="location-outline"
                title="Nenhuma microregião vinculada"
                style={styles.emptyStateCompact}
              />
            ) : (
              <View style={styles.chipWrap}>
                {vinculosMicroregioes.map((item) => (
                  <View key={`${item.regiao}-${item.microregiao}`} style={styles.infoChip}>
                    <Text style={styles.infoChipText}>{item.microregiao}</Text>
                    {item.regiao ? <Text style={styles.infoChipMeta}>{item.regiao}</Text> : null}
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.subsectionTitle}>
              {propriedadesAtribuidas.length > 0 ? 'Propriedades atribuídas por microrregião' : 'Propriedades no escopo visual'}
            </Text>
            {propriedadesColaborador.length === 0 ? (
              <EmptyState
                icon="home-outline"
                title="Nenhuma propriedade encontrada"
                message="Nenhuma propriedade encontrada para este escopo."
                style={styles.emptyStateCompact}
              />
            ) : (
              propriedadesColaborador.map((propriedade) => (
                <PropertyRow
                  key={getFazendaId(propriedade)}
                  propriedade={propriedade}
                  vinculo={getVinculoDaPropriedade(getFazendaId(propriedade))}
                  onPress={() => abrirPropriedade(propriedade)}
                />
              ))
            )}
          </SectionCard>
        )}

        {usuario.perfil === 'admin' && (
          <SectionCard title="Dados administrativos">
            <InfoRow icon="earth-outline" label="Perfil administrativo" value="Administrador" />
            <InfoRow icon="shield-outline" label="Nível administrativo" value={getNivelAdminLabel(usuario.nivel_administrativo)} />
            <InfoRow icon="shield-checkmark-outline" label="Escopo" value={(usuario.regioes_acesso || ['Brasil']).join(', ')} />
            <InfoBox message="Administrador é um perfil demonstrativo do MVP local e não concede autenticação ou RBAC real." style={styles.inlineInfoBox} />
          </SectionCard>
        )}

        <SectionCard title="Observações">
          <InfoBox message={usuario.observacoes || 'Nenhuma observação registrada.'} style={styles.inlineInfoBox} />
        </SectionCard>

        <View style={{ height: spacing.xl * 3 }} />
      </ScrollView>

      <FormFooter
        showCancel={false}
        onSubmit={() => navigation.navigate('EditarUsuario', { userId: usuario.id })}
        submitLabel="Editar cadastro local"
        submitIcon="create-outline"
      />
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
  propertyMeta: {
    color: colors.primary,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    marginTop: 3,
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
  infoChipMeta: {
    color: colors.muted,
    fontSize: typography.fontCaption,
    marginTop: 2,
  },
  emptyStateCompact: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  inlineInfoBox: {
    marginBottom: 0,
  },
  localAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: spacing.radiusSm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  localAccessButtonText: {
    color: colors.primary,
    fontSize: typography.fontBody - 1,
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
