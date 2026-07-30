import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';
import CreateActionButton from '../components/CreateActionButton';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import SegmentedChips from '../components/SegmentedChips';
import FilterBottomSheet, {
  ActiveFilterBar,
  FilterSection,
  FilterTrigger,
} from '../components/FilterBottomSheet';
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
  const [perfilFiltroRascunho, setPerfilFiltroRascunho] = useState('todos');
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);

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

  const perfilOptions = PERFIS_USUARIO_ADMIN.map((perfil) => ({
    value: perfil.key,
    label: perfil.label,
    count: totalPorPerfil[perfil.key as keyof typeof totalPorPerfil] || 0,
  }));
  const perfilFiltroLabel = perfilOptions.find((perfil) => perfil.value === perfilFiltro)?.label;

  const abrirFiltros = () => {
    setPerfilFiltroRascunho(perfilFiltro);
    setFiltrosVisiveis(true);
  };

  const cancelarFiltros = () => {
    setPerfilFiltroRascunho(perfilFiltro);
    setFiltrosVisiveis(false);
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
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome, e-mail, documento ou escopo..."
        />
      </View>

      <View style={styles.filterSection}>
        <FilterTrigger
          activeCount={perfilFiltro === 'todos' ? 0 : 1}
          onPress={abrirFiltros}
          style={styles.filterTrigger}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <ActiveFilterBar
          items={perfilFiltro === 'todos' ? [] : [{
            key: 'perfil',
            label: perfilFiltroLabel || 'Perfil',
            icon: 'people',
            color: colors.info,
            onRemove: () => setPerfilFiltro('todos'),
          }]}
          onClear={() => setPerfilFiltro('todos')}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando usuários...</Text>
          </View>
        ) : usuariosFiltrados.length === 0 ? (
          <EmptyState
            icon={busca ? 'search-outline' : 'people-outline'}
            title="Nenhum usuário encontrado"
            message="Ajuste a busca ou o filtro de perfil para continuar."
            style={styles.emptyState}
          />
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

      <CreateActionButton
        label="Novo Usuário"
        icon="person-add-outline"
        onPress={() => navigation.navigate('NovoUsuario')}
        accessibilityLabel="Cadastrar novo usuário"
      />

      <FilterBottomSheet
        visible={filtrosVisiveis}
        onRequestClose={cancelarFiltros}
        onClear={() => setPerfilFiltroRascunho('todos')}
        onApply={() => {
          setPerfilFiltro(perfilFiltroRascunho);
          setFiltrosVisiveis(false);
        }}
        subtitle="Filtre a lista pelo perfil de acesso"
      >
        <FilterSection title="Perfil">
          <SegmentedChips
            options={perfilOptions}
            value={perfilFiltroRascunho}
            onChange={setPerfilFiltroRascunho}
          />
        </FilterSection>
      </FilterBottomSheet>
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
  filterSection: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
  },
  filterTrigger: {
    width: '100%',
  },
  filterContent: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
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
  emptyState: {
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.lg,
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
