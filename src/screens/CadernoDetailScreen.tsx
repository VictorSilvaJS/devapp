import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import { useToast } from '../components/Toast';
import { CadernoCampo, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { colors, shadows, spacing, typography } from '../theme';
import { avaliarAcessoCaderno } from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';

const { width } = Dimensions.get('window');

export default function CadernoDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { user } = useAuth();

  const { cadernoId, registroId, id } = route.params || {};
  const cadernoRouteId = cadernoId || registroId || id;

  const [registro, setRegistro] = useState(null);
  const [fazenda, setFazenda] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadRegistro();
    }, [cadernoRouteId, user])
  );

  const loadRegistro = async () => {
    setLoading(true);
    try {
      if (!cadernoRouteId) {
        throw new Error('Registro de caderno não informado');
      }

      const [registroData, fazendas] = await Promise.all([
        CadernoCampo.get(cadernoRouteId),
        Produtor.list(),
      ]);

      const acesso = avaliarAcessoCaderno(user, registroData, fazendas);

      if (acesso.status !== 'permitido') {
        setRegistro(null);
        setFazenda(null);
        toast.showWarning('Você não tem permissão para acessar este registro.');
        navigation.goBack();
        return;
      }

      setRegistro(registroData);
      setFazenda(acesso.fazenda);
    } catch (error) {
      console.error('Erro ao carregar registro de caderno:', error);
      toast.showError('Erro ao carregar detalhe do caderno');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const getTipoColor = (tipo) => {
    const cores = {
      plantio: colors.success,
      adubacao: colors.info,
      aplicacao: colors.purple,
      colheita: colors.warning,
      analise_solo: colors.orange,
      vistoria: colors.cyan,
      outro: colors.muted,
    };
    return cores[tipo] || colors.muted;
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      plantio: 'Plantio',
      adubacao: 'Adubação',
      aplicacao: 'Aplicação',
      colheita: 'Colheita',
      analise_solo: 'Análise de Solo',
      vistoria: 'Vistoria',
      outro: 'Outro',
    };
    return labels[tipo] || String(tipo || 'Registro').replace(/_/g, ' ');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatArea = (area) => {
    const areaNumber = Number(area);
    if (!Number.isFinite(areaNumber) || areaNumber <= 0) return null;
    return `${areaNumber.toLocaleString('pt-BR')} ha`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Detalhe do Caderno" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando registro...</Text>
        </View>
      </View>
    );
  }

  if (!registro) {
    return (
      <View style={styles.container}>
        <Header title="Detalhe do Caderno" showBack />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.muted} />
          <Text style={styles.emptyText}>Registro não encontrado</Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = fazenda ? getFazendaUiInfo(fazenda) : null;
  const tipoColor = getTipoColor(registro.tipo_atividade);
  const areaFormatada = formatArea(registro.area_aplicada);
  const visivelParaProdutor = registro.visivel_para_produtor === true;
  const visibilidadeColor = visivelParaProdutor ? colors.success : colors.warning;
  const fotos = Array.isArray(registro.fotos) ? registro.fotos : [];
  const produtos = Array.isArray(registro.produtos_utilizados) ? registro.produtos_utilizados : [];

  return (
    <View style={styles.container}>
      <Header title="Detalhe do Caderno" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: tipoColor }]}>
            <Text style={styles.statusText}>{getTipoLabel(registro.tipo_atividade)}</Text>
          </View>
          <View style={[styles.visibilityBadge, { backgroundColor: visibilidadeColor + '20' }]}>
            <Ionicons
              name={visivelParaProdutor ? 'eye-outline' : 'lock-closed-outline'}
              size={16}
              color={visibilidadeColor}
            />
            <Text style={[styles.visibilityText, { color: visibilidadeColor }]}>
              {visivelParaProdutor ? 'Visível ao produtor' : 'Restrito à equipe'}
            </Text>
          </View>
        </View>

        {fazenda && fazendaInfo && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="home-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Fazenda</Text>
            </View>
            <TouchableOpacity
              style={styles.fazendaInfo}
              onPress={() => navigation.navigate('ProdutorDetail', { id: fazenda.id })}
            >
              <View style={styles.fazendaDetails}>
                <Text style={styles.fazendaNome}>{fazendaInfo.fazendaNome}</Text>
                <Text style={styles.fazendaSubtext}>{fazendaInfo.titularNome}</Text>
                <Text style={styles.fazendaSubtext}>{fazendaInfo.localizacao}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="book-outline" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>Registro de Campo</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Data da Atividade</Text>
              <Text style={styles.infoValue}>{formatDate(registro.data_atividade)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Responsável</Text>
              <Text style={styles.infoValue}>{registro.colaborador_responsavel || '-'}</Text>
            </View>
          </View>

          {registro.talhao && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Talhão</Text>
                <Text style={styles.infoValue}>{registro.talhao}</Text>
              </View>
            </View>
          )}

          {areaFormatada && (
            <View style={styles.infoRow}>
              <Ionicons name="expand" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Área Aplicada</Text>
                <Text style={styles.infoValue}>{areaFormatada}</Text>
              </View>
            </View>
          )}

          {registro.data_criacao && (
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Criado em</Text>
                <Text style={styles.infoValue}>{formatDate(registro.data_criacao)}</Text>
              </View>
            </View>
          )}
        </View>

        {produtos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="flask-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Produtos</Text>
            </View>
            <View style={styles.productList}>
              {produtos.map((produto, index) => (
                <View key={`${produto}-${index}`} style={styles.productChip}>
                  <Text style={styles.productText}>{produto}</Text>
                </View>
              ))}
            </View>
            {registro.dosagem && (
              <View style={styles.dosageBox}>
                <Text style={styles.infoLabel}>Dosagem</Text>
                <Text style={styles.infoValue}>{registro.dosagem}</Text>
              </View>
            )}
          </View>
        )}

        {registro.condicoes_clima && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="partly-sunny-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Condições Climáticas</Text>
            </View>
            <Text style={styles.textContent}>{registro.condicoes_clima}</Text>
          </View>
        )}

        {registro.observacoes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Observações</Text>
            </View>
            <Text style={styles.textContent}>{registro.observacoes}</Text>
          </View>
        )}

        {fotos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Fotos ({fotos.length})</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
              {fotos.map((foto, index) => (
                <Image
                  key={`${typeof foto === 'string' ? foto : foto?.uri}-${index}`}
                  source={{ uri: typeof foto === 'string' ? foto : foto?.uri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontBody,
    color: colors.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  statusText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.card,
    textTransform: 'uppercase',
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radiusSm,
  },
  visibilityText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: '700',
    color: colors.text,
  },
  fazendaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fazendaDetails: {
    flex: 1,
  },
  fazendaNome: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  fazendaSubtext: {
    fontSize: typography.fontSmall,
    color: colors.muted,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSmall,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
  },
  productList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  productChip: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
    borderWidth: 1,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  productText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  dosageBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  textContent: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    lineHeight: 22,
  },
  photosContainer: {
    marginTop: spacing.sm,
  },
  photo: {
    width: width * 0.6,
    height: width * 0.4,
    borderRadius: spacing.radiusSm,
    marginRight: spacing.md,
  },
});
