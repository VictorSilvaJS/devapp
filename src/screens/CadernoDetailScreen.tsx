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
import { CadernoCampo, Produtor, User } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { colors, semanticColors, shadows, spacing, typography } from '../theme';
import {
  avaliarAcessoCaderno,
  podeEditarCadernoEmFazenda,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import {
  getCadernoTalhaoLabel,
  getCadernoPeriodoProdutivoLabel,
  getCadernoOrigemLabel,
  getCadernoTipoLabel,
  getCadernoVisibilidadeLabel,
  isCadernoRegistradoPeloProdutor,
  isCadernoVisivelParaProdutor,
} from '../utils/cadernoFormCompat';
import { buildPropriedadeDetailRouteParams } from '../navigation/propriedadeRouteCompat';
import { normalizeCadernoLocalizacao } from '../utils/cadernoLocalizacaoCompat';
import { getCadernoLocalizacaoPresentation } from '../utils/cadernoLocalizacaoUiCompat';
import { formatAreaHa, normalizeAreaValue } from '../utils/talhaoMedidasCompat';

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
  const [usuarios, setUsuarios] = useState<any[]>([]);
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

      const [registroData, fazendas, usuariosData] = await Promise.all([
        CadernoCampo.get(cadernoRouteId),
        Produtor.list(),
        User.list().catch(() => []),
      ]);

      const acesso = avaliarAcessoCaderno(user, registroData, fazendas);

      if (acesso.status !== 'permitido') {
        setRegistro(null);
        setFazenda(null);
        setUsuarios([]);
        toast.showWarning('Você não tem permissão para acessar este registro.');
        navigation.goBack();
        return;
      }

      setRegistro(registroData);
      setFazenda(acesso.fazenda);
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
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
      observacao: colors.muted,
      visita_tecnica: colors.cyan,
      fertilidade: colors.success,
      correcao_solo: colors.info,
      prescricao: colors.purple,
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
    return normalizeAreaValue(area) == null ? null : formatAreaHa(area);
  };

  const canEdit = () => podeEditarCadernoEmFazenda(user, registro, fazenda);

  const handleEditar = () => {
    if (!canEdit()) {
      toast.showWarning('Você não tem permissão para editar este registro.');
      return;
    }

    navigation.navigate('EditarCaderno', { cadernoId: cadernoRouteId });
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
  const visivelParaProdutor = isCadernoVisivelParaProdutor(registro);
  const visibilidadeColor = visivelParaProdutor ? colors.success : colors.warning;
  const tipoLabel = getCadernoTipoLabel(registro.tipo_atividade);
  const periodoProdutivoLabel = getCadernoPeriodoProdutivoLabel(registro);
  const registradoPeloProdutor = isCadernoRegistradoPeloProdutor(registro);
  const fotos = Array.isArray(registro.fotos) ? registro.fotos : [];
  const produtos = Array.isArray(registro.produtos_utilizados) ? registro.produtos_utilizados : [];
  const localizacao = normalizeCadernoLocalizacao(registro);
  const localizacaoPresentation = getCadernoLocalizacaoPresentation(localizacao);
  const usuarioCaptura = localizacao?.localizacao_captured_by
    ? usuarios.find((usuario) => String(usuario?.id || '').trim() === localizacao.localizacao_captured_by)
    : null;
  const nomeUsuarioCaptura = String(usuarioCaptura?.nome || usuarioCaptura?.full_name || '').trim();

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
            <Text style={styles.statusText}>{tipoLabel}</Text>
          </View>
          <View style={[styles.visibilityBadge, { backgroundColor: visibilidadeColor + '20' }]}>
            <Ionicons
              name={visivelParaProdutor ? 'eye-outline' : 'lock-closed-outline'}
              size={16}
              color={visibilidadeColor}
            />
            <Text style={[styles.visibilityText, { color: visibilidadeColor }]}>
              {getCadernoVisibilidadeLabel(registro)}
            </Text>
          </View>
          {registradoPeloProdutor && (
            <View style={[styles.visibilityBadge, { backgroundColor: semanticColors.primary.surface }]}>
              <Ionicons name="person-outline" size={16} color={semanticColors.primary.text} />
              <Text style={[styles.visibilityText, { color: semanticColors.primary.text }]}>
                {getCadernoOrigemLabel(registro)}
              </Text>
            </View>
          )}
        </View>

        {fazenda && fazendaInfo && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="home-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Propriedade</Text>
            </View>
            <TouchableOpacity
              style={styles.fazendaInfo}
              onPress={() => {
                const params = buildPropriedadeDetailRouteParams(fazenda);
                if (params) navigation.navigate('ProdutorDetail', params);
              }}
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
            <Ionicons name="pricetag" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Tipo de registro</Text>
              <Text style={styles.infoValue}>{tipoLabel}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Data do registro</Text>
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

          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Talhão</Text>
              <Text style={styles.infoValue}>{getCadernoTalhaoLabel(registro)}</Text>
            </View>
          </View>

          {periodoProdutivoLabel ? (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Safra/Safrinha</Text>
                <Text style={styles.infoValue}>{periodoProdutivoLabel}</Text>
              </View>
            </View>
          ) : null}

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

        {localizacao ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pin-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Ponto registrado em campo</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>Localização registrada por ação explícita</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Latitude</Text>
                <Text style={styles.infoValue}>{localizacaoPresentation?.latitudeText}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Longitude</Text>
                <Text style={styles.infoValue}>{localizacaoPresentation?.longitudeText}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="locate-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Precisão informada</Text>
                <Text style={styles.infoValue}>
                  {localizacaoPresentation?.accuracyValueText}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={colors.muted} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Capturada em</Text>
                <Text style={styles.infoValue}>{localizacaoPresentation?.capturedAtText}</Text>
              </View>
            </View>

            {nomeUsuarioCaptura ? (
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={20} color={colors.muted} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Capturada por</Text>
                  <Text style={styles.infoValue}>{nomeUsuarioCaptura}</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.locationExplanation}>
              A posição representa a leitura aproximada informada pelo aparelho no momento do registro.
            </Text>
          </View>
        ) : null}

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

      {canEdit() && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleEditar}>
            <Ionicons name="create-outline" size={20} color={colors.card} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
        </View>
      )}
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
  locationExplanation: {
    fontSize: typography.fontSmall,
    color: colors.textLight,
    lineHeight: 19,
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
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    ...shadows.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: spacing.radiusSm,
    gap: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.card,
  },
});
