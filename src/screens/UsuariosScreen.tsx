import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import { Produtor, User } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import { colors, shadows, spacing, typography } from '../theme';
import {
  PERFIS_USUARIO_ADMIN,
  buildUsuarioVinculoPrincipal,
  getUsuarioNome,
  getUsuarioPerfilLabel,
  getUsuarioStatusInfo,
  usuarioMatchesBusca,
} from '../utils/usuarioAdminCompat';

const getPerfilColor = (perfil?: string) => {
  if (perfil === 'admin') return colors.primary;
  if (perfil === 'colaborador') return colors.info;
  if (perfil === 'produtor') return colors.success;
  return colors.muted;
};

const getStatusColors = (status: any) => {
  if (status.key === 'ativo') return { bg: colors.successBg, text: colors.success };
  if (status.key === 'pendente') return { bg: colors.amberLight, text: colors.warning };
  return { bg: colors.errorBgLight, text: colors.error };
};

export default function UsuariosScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthState();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [perfilFiltro, setPerfilFiltro] = useState('todos');

  const load = async () => {
    setLoading(true);
    try {
      const [usuariosData, propriedadesData] = await Promise.all([
        User.list(),
        Produtor.list(),
      ]);

      setUsuarios(usuariosData as any[]);
      setPropriedades(propriedadesData as any[]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user?.perfil === 'admin') {
        load();
      } else {
        setLoading(false);
      }
    }, [user?.perfil])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const usuariosFiltrados = usuarios
    .filter((usuario) => perfilFiltro === 'todos' || usuario.perfil === perfilFiltro)
    .filter((usuario) => usuarioMatchesBusca(usuario, busca))
    .sort((a, b) => getUsuarioNome(a).localeCompare(getUsuarioNome(b)));

  const totalPorPerfil = {
    todos: usuarios.length,
    produtor: usuarios.filter((usuario) => usuario.perfil === 'produtor').length,
    colaborador: usuarios.filter((usuario) => usuario.perfil === 'colaborador').length,
    admin: usuarios.filter((usuario) => usuario.perfil === 'admin').length,
  };

  if (user?.perfil !== 'admin') {
    return (
      <View style={styles.container}>
        <Header title="Usuários" />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedTitle}>Acesso restrito</Text>
          <Text style={styles.blockedText}>Somente administradores acessam a gestão de usuários no mock.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Usuários" />

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, e-mail, documento ou escopo..."
            placeholderTextColor={colors.muted}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} style={styles.clearSearch}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {PERFIS_USUARIO_ADMIN.map((perfil) => {
            const active = perfilFiltro === perfil.key;
            return (
              <TouchableOpacity
                key={perfil.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setPerfilFiltro(perfil.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {perfil.label}
                </Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                    {totalPorPerfil[perfil.key] || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando usuários...</Text>
          </View>
        ) : usuariosFiltrados.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name={busca ? 'search-outline' : 'people-outline'} size={72} color={colors.muted} />
            <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
            <Text style={styles.emptyText}>Ajuste a busca ou o filtro de perfil para continuar.</Text>
          </View>
        ) : (
          usuariosFiltrados.map((usuario) => {
            const nome = getUsuarioNome(usuario);
            const status = getUsuarioStatusInfo(usuario);
            const statusColor = getStatusColors(status);
            const perfilColor = getPerfilColor(usuario.perfil);
            const vinculo = buildUsuarioVinculoPrincipal(usuario, propriedades);

            return (
              <TouchableOpacity
                key={usuario.id}
                style={styles.userCard}
                onPress={() => navigation.navigate('UsuarioDetail', { userId: usuario.id })}
                activeOpacity={0.82}
              >
                <LinearGradient
                  colors={[perfilColor, perfilColor + 'CC']}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>{nome.charAt(0).toUpperCase()}</Text>
                </LinearGradient>

                <View style={styles.userInfo}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.userName} numberOfLines={1}>{nome}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                      <Text style={[styles.statusText, { color: statusColor.text }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.userEmail} numberOfLines={1}>{usuario.email || 'E-mail não informado'}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.perfilBadge, { backgroundColor: perfilColor + '18' }]}>
                      <Text style={[styles.perfilText, { color: perfilColor }]}>
                        {getUsuarioPerfilLabel(usuario.perfil)}
                      </Text>
                    </View>
                    <Text style={styles.vinculoText} numberOfLines={1}>{vinculo}</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NovoUsuario')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.fabGradient}>
          <Ionicons name="person-add-outline" size={22} color={colors.white} />
          <Text style={styles.fabText}>Novo Usuário</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchSection: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontBody,
  },
  clearSearch: {
    padding: spacing.xs,
  },
  filterSection: {
    backgroundColor: colors.card,
    paddingBottom: spacing.md,
  },
  filterContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontWeight: typography.weightSemibold,
    fontSize: typography.fontCaption + 1,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: colors.borderLight,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  filterCountTextActive: {
    color: colors.white,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.screen + 96,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 3,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.fontBody,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: spacing.card + 2,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 3,
  },
  userName: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
  },
  userEmail: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  perfilBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.radiusSm,
  },
  perfilText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weightBold,
  },
  vinculoText: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.radiusSm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weightBold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.fontBody,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.screen,
    bottom: spacing.screen + 20,
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.lg,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  fabText: {
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
