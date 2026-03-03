import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Retorna cor e label de classificação para valores de elementos do solo.
 */
function classificarElemento(nome, valor) {
  const classificacoes = {
    ph: [
      { max: 5.0, label: 'Muito Ácido', cor: colors.error },
      { max: 5.5, label: 'Ácido', cor: colors.warning },
      { max: 6.0, label: 'Levemente Ácido', cor: colors.amber },
      { max: 6.5, label: 'Ideal', cor: colors.success },
      { max: 7.0, label: 'Neutro', cor: colors.info },
      { max: Infinity, label: 'Alcalino', cor: colors.purple },
    ],
    fosforo: [
      { max: 5.0, label: 'Muito Baixo', cor: colors.error },
      { max: 10.0, label: 'Baixo', cor: colors.warning },
      { max: 15.0, label: 'Médio', cor: colors.amber },
      { max: 20.0, label: 'Alto', cor: colors.success },
      { max: Infinity, label: 'Muito Alto', cor: colors.info },
    ],
    potassio: [
      { max: 0.15, label: 'Muito Baixo', cor: colors.error },
      { max: 0.25, label: 'Baixo', cor: colors.warning },
      { max: 0.35, label: 'Médio', cor: colors.amber },
      { max: 0.50, label: 'Alto', cor: colors.success },
      { max: Infinity, label: 'Muito Alto', cor: colors.info },
    ],
    materia_organica: [
      { max: 1.5, label: 'Baixo', cor: colors.error },
      { max: 2.5, label: 'Médio', cor: colors.warning },
      { max: 3.5, label: 'Bom', cor: colors.success },
      { max: Infinity, label: 'Alto', cor: colors.info },
    ],
    saturacao_bases: [
      { max: 40, label: 'Muito Baixo', cor: colors.error },
      { max: 50, label: 'Baixo', cor: colors.warning },
      { max: 60, label: 'Médio', cor: colors.amber },
      { max: 70, label: 'Bom', cor: colors.success },
      { max: Infinity, label: 'Alto', cor: colors.info },
    ],
    aluminio: [
      { max: 0.1, label: 'Ausente', cor: colors.success },
      { max: 0.3, label: 'Baixo', cor: colors.amber },
      { max: 0.6, label: 'Médio', cor: colors.warning },
      { max: Infinity, label: 'Tóxico', cor: colors.error },
    ],
  };

  const faixas = classificacoes[nome];
  if (!faixas) return { label: '-', cor: colors.muted };
  
  for (const f of faixas) {
    if (valor <= f.max) return { label: f.label, cor: f.cor };
  }
  return { label: '-', cor: colors.muted };
}

/**
 * Modal de detalhes do talhão - mostra textura, elementos, informações.
 * 
 * Props:
 * - visible: boolean
 * - talhao: objeto do talhão (limite de área)
 * - onClose: callback para fechar
 */
export default function TalhaoDetailModal({ visible, talhao, onClose }) {
  if (!talhao) return null;

  const elementos = talhao.elementos || {};
  
  const elementosConfig = [
    { key: 'ph', nome: 'pH', unidade: '', icon: 'flask-outline' },
    { key: 'fosforo', nome: 'Fósforo (P)', unidade: 'mg/dm³', icon: 'leaf-outline' },
    { key: 'potassio', nome: 'Potássio (K)', unidade: 'cmolc/dm³', icon: 'nutrition-outline' },
    { key: 'calcio', nome: 'Cálcio (Ca)', unidade: 'cmolc/dm³', icon: 'fitness-outline' },
    { key: 'magnesio', nome: 'Magnésio (Mg)', unidade: 'cmolc/dm³', icon: 'water-outline' },
    { key: 'materia_organica', nome: 'Matéria Orgânica', unidade: '%', icon: 'earth-outline' },
    { key: 'ctc', nome: 'CTC', unidade: 'cmolc/dm³', icon: 'analytics-outline' },
    { key: 'saturacao_bases', nome: 'Saturação de Bases (V%)', unidade: '%', icon: 'bar-chart-outline' },
    { key: 'aluminio', nome: 'Alumínio (Al)', unidade: 'cmolc/dm³', icon: 'alert-circle-outline' },
    { key: 'enxofre', nome: 'Enxofre (S)', unidade: 'mg/dm³', icon: 'flame-outline' },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.colorDot, { backgroundColor: talhao.cor || colors.primary }]} />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>{talhao.talhao || talhao.nome}</Text>
                <Text style={styles.headerSubtitle}>{talhao.nome}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Info Cards Row */}
            <View style={styles.infoRow}>
              <View style={styles.infoCard}>
                <Ionicons name="resize-outline" size={22} color={colors.primary} />
                <Text style={styles.infoValue}>{talhao.area_hectares || '-'} ha</Text>
                <Text style={styles.infoLabel}>Área</Text>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="git-network-outline" size={22} color={colors.secondary} />
                <Text style={styles.infoValue}>{talhao.perimetro_km || '-'} km</Text>
                <Text style={styles.infoLabel}>Perímetro</Text>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="calendar-outline" size={22} color={colors.info} />
                <Text style={styles.infoValue}>{talhao.ano || '-'}</Text>
                <Text style={styles.infoLabel}>Ano</Text>
              </View>
            </View>

            {/* Características do Solo */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="layers-outline" size={18} color={colors.primary} /> Características do Solo
              </Text>
              <View style={styles.soloInfo}>
                <View style={styles.soloRow}>
                  <Text style={styles.soloLabel}>Textura:</Text>
                  <View style={styles.soloTag}>
                    <Text style={styles.soloTagText}>{talhao.textura || '-'}</Text>
                  </View>
                </View>
                <View style={styles.soloRow}>
                  <Text style={styles.soloLabel}>Tipo de Solo:</Text>
                  <Text style={styles.soloValue}>{talhao.tipo_solo || '-'}</Text>
                </View>
                <View style={styles.soloRow}>
                  <Text style={styles.soloLabel}>Cultura Atual:</Text>
                  <View style={[styles.soloTag, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                    <Ionicons name="leaf" size={12} color={colors.success} />
                    <Text style={[styles.soloTagText, { color: colors.success }]}>{talhao.cultura_atual || '-'}</Text>
                  </View>
                </View>
                <View style={styles.soloRow}>
                  <Text style={styles.soloLabel}>Safra:</Text>
                  <Text style={styles.soloValue}>{talhao.safra || '-'}</Text>
                </View>
                <View style={styles.soloRow}>
                  <Text style={styles.soloLabel}>Data Upload:</Text>
                  <Text style={styles.soloValue}>{formatDate(talhao.data_upload)}</Text>
                </View>
              </View>
            </View>

            {/* Elementos do Solo */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="flask-outline" size={18} color={colors.primary} /> Elementos do Solo
              </Text>
              <View style={styles.elementosGrid}>
                {elementosConfig.map(el => {
                  const valor = elementos[el.key];
                  if (valor === undefined || valor === null) return null;
                  const classif = classificarElemento(el.key, valor);
                  
                  return (
                    <View key={el.key} style={styles.elementoCard}>
                      <View style={styles.elementoHeader}>
                        <Ionicons name={el.icon} size={16} color={colors.primary} />
                        <Text style={styles.elementoNome} numberOfLines={1}>{el.nome}</Text>
                      </View>
                      <Text style={styles.elementoValor}>
                        {valor}{el.unidade ? ` ${el.unidade}` : ''}
                      </Text>
                      <View style={[styles.elementoBadge, { backgroundColor: classif.cor + '20', borderColor: classif.cor }]}>
                        <Text style={[styles.elementoBadgeText, { color: classif.cor }]}>
                          {classif.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Observações */}
            {talhao.observacoes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="chatbox-outline" size={18} color={colors.primary} /> Observações
                </Text>
                <View style={styles.obsBox}>
                  <Text style={styles.obsText}>{talhao.observacoes}</Text>
                </View>
              </View>
            )}

            {/* Status Offline */}
            <View style={styles.offlineContainer}>
              <View style={[
                styles.offlineBadge,
                talhao.disponivel_offline ? styles.offlineOk : styles.offlineNo
              ]}>
                <Ionicons 
                  name={talhao.disponivel_offline ? 'cloud-done-outline' : 'cloud-offline-outline'} 
                  size={16} 
                  color={talhao.disponivel_offline ? colors.success : colors.muted} 
                />
                <Text style={[
                  styles.offlineText,
                  { color: talhao.disponivel_offline ? colors.success : colors.muted }
                ]}>
                  {talhao.disponivel_offline ? 'Disponível offline' : 'Requer conexão'}
                </Text>
              </View>
            </View>

            <View style={{ height: spacing.xl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  infoValue: {
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  infoLabel: {
    fontSize: typography.fontCaption,
    color: colors.muted,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  soloInfo: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  soloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  soloLabel: {
    fontSize: typography.fontBody - 1,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
  },
  soloValue: {
    fontSize: typography.fontBody - 1,
    color: colors.text,
    fontWeight: typography.weightSemibold,
  },
  soloTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 4,
  },
  soloTagText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  elementosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  elementoCard: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.sm) / 2 - 1,
    backgroundColor: colors.card,
    borderRadius: spacing.radiusSm,
    padding: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  elementoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  elementoNome: {
    fontSize: typography.fontCaption - 0.5,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
    flex: 1,
  },
  elementoValor: {
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4,
  },
  elementoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  elementoBadgeText: {
    fontSize: typography.fontSmall,
    fontWeight: typography.weightBold,
  },
  obsBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  obsText: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
  },
  offlineContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  offlineOk: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  offlineNo: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.borderLight,
  },
  offlineText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
});
