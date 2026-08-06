import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFiltros } from '../contexts/FiltroContext';
import { FILTRO_TODOS } from '../utils/filtroTerritorial';
import { colors, shadows, spacing, typography } from '../theme';

type TipoFiltro = 'uf' | 'municipio' | 'propriedade' | null;

export default function FiltroTerritorial() {
  const {
    filtros,
    ufs,
    municipios,
    propriedades,
    setUf,
    setMunicipio,
    setPropriedade,
    limparFiltros,
    getFiltroAtivo,
    temFiltroAtivo,
  } = useFiltros();
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>(null);

  const municipioSelecionado = municipios.find((item) => item.id === filtros.municipio);
  const propriedadeSelecionada = propriedades.find((item) => item.id === filtros.propriedadeId);

  const abrir = (tipo: Exclude<TipoFiltro, null>) => setTipoFiltro(tipo);
  const fechar = () => setTipoFiltro(null);
  const ativo = (tipo: Exclude<TipoFiltro, null>) => {
    if (tipo === 'uf') return filtros.uf !== FILTRO_TODOS;
    if (tipo === 'municipio') return filtros.municipio !== FILTRO_TODOS;
    return Boolean(filtros.propriedadeId);
  };
  const titulo = tipoFiltro === 'uf'
    ? 'Selecionar UF'
    : tipoFiltro === 'municipio'
      ? 'Selecionar município'
      : 'Selecionar propriedade';

  const selecionarUf = (uf: string) => {
    setUf(uf);
    fechar();
  };
  const selecionarMunicipio = (municipio: string) => {
    setMunicipio(municipio);
    fechar();
  };
  const selecionarPropriedade = (propriedade?: any) => {
    setPropriedade(propriedade?.nome || FILTRO_TODOS, propriedade?.id || null);
    fechar();
  };

  const FilterButton = ({
    tipo,
    texto,
    icon,
  }: {
    tipo: Exclude<TipoFiltro, null>;
    texto: string;
    icon: any;
  }) => {
    const selecionado = ativo(tipo);
    return (
      <TouchableOpacity
        style={[styles.filterButton, selecionado && styles.filterButtonActive]}
        onPress={() => abrir(tipo)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Filtrar por ${tipo}: ${texto}`}
      >
        <Ionicons name={icon} size={18} color={selecionado ? colors.white : colors.primary} />
        <Text style={[styles.filterText, selecionado && styles.filterTextActive]} numberOfLines={1}>
          {texto}
        </Text>
        <Ionicons name="chevron-down" size={16} color={selecionado ? colors.white : colors.primary} />
      </TouchableOpacity>
    );
  };

  const Option = ({
    selected,
    label,
    subtitle,
    icon,
    onPress,
  }: {
    selected: boolean;
    label: string;
    subtitle?: string;
    icon: any;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={selected ? colors.white : colors.textLight} />
      <View style={styles.optionTextContainer}>
        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.optionSubtitle, selected && styles.optionTextSelected]}>{subtitle}</Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.white} /> : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="filter" size={16} color={colors.textLight} />
        <Text style={styles.title}>Filtre por localização ou propriedade</Text>
      </View>

      <View style={styles.row}>
        <FilterButton
          tipo="uf"
          texto={filtros.uf === FILTRO_TODOS ? 'Todas as UFs' : filtros.uf}
          icon="location-outline"
        />
        <FilterButton
          tipo="municipio"
          texto={municipioSelecionado?.nome || 'Todos os municípios'}
          icon="map-outline"
        />
      </View>
      <View style={styles.row}>
        <FilterButton
          tipo="propriedade"
          texto={propriedadeSelecionada?.nome || 'Todas as propriedades'}
          icon="business-outline"
        />
        {temFiltroAtivo() ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={limparFiltros}
            accessibilityRole="button"
            accessibilityLabel="Limpar filtros territoriais"
          >
            <Ionicons name="close-circle" size={24} color={colors.error} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.summary}>
        <Ionicons name={temFiltroAtivo() ? 'funnel' : 'apps-outline'} size={13} color={colors.primary} />
        <Text style={styles.summaryText}>Visualizando: {getFiltroAtivo()}</Text>
      </View>

      <Modal visible={tipoFiltro !== null} transparent animationType="fade" onRequestClose={fechar}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={fechar}>
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{titulo}</Text>
              <TouchableOpacity onPress={fechar} accessibilityLabel="Fechar seleção">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.options}>
              {tipoFiltro === 'uf' ? (
                <>
                  <Option
                    selected={filtros.uf === FILTRO_TODOS}
                    label="Todas as UFs"
                    icon="earth-outline"
                    onPress={() => selecionarUf(FILTRO_TODOS)}
                  />
                  {ufs.map((uf) => (
                    <Option
                      key={uf}
                      selected={filtros.uf === uf}
                      label={uf}
                      icon="location-outline"
                      onPress={() => selecionarUf(uf)}
                    />
                  ))}
                </>
              ) : null}

              {tipoFiltro === 'municipio' ? (
                <>
                  <Option
                    selected={filtros.municipio === FILTRO_TODOS}
                    label="Todos os municípios"
                    icon="map-outline"
                    onPress={() => selecionarMunicipio(FILTRO_TODOS)}
                  />
                  {municipios.map((municipio) => (
                    <Option
                      key={municipio.id}
                      selected={filtros.municipio === municipio.id}
                      label={municipio.nome}
                      subtitle={municipio.uf}
                      icon="pin-outline"
                      onPress={() => selecionarMunicipio(municipio.id)}
                    />
                  ))}
                </>
              ) : null}

              {tipoFiltro === 'propriedade' ? (
                <>
                  <Option
                    selected={!filtros.propriedadeId}
                    label="Todas as propriedades"
                    icon="apps-outline"
                    onPress={() => selecionarPropriedade()}
                  />
                  {propriedades.map((propriedade) => (
                    <Option
                      key={propriedade.id}
                      selected={filtros.propriedadeId === propriedade.id}
                      label={propriedade.nome}
                      subtitle={[propriedade.titular, propriedade.municipio, propriedade.uf].filter(Boolean).join(' • ')}
                      icon="business-outline"
                      onPress={() => selecionarPropriedade(propriedade)}
                    />
                  ))}
                </>
              ) : null}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.textLight, fontSize: typography.fontCaption, fontWeight: typography.weightSemibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  filterButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.backgroundSoft,
  },
  filterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { flex: 1, color: colors.primary, fontSize: typography.fontCaption, fontWeight: typography.weightSemibold },
  filterTextActive: { color: colors.white },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  summaryText: { flex: 1, color: colors.textLight, fontSize: typography.fontCaption },
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.screen, backgroundColor: colors.overlay },
  modal: {
    maxHeight: '78%',
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: { color: colors.text, fontSize: typography.fontSubtitle, fontWeight: typography.weightBold },
  options: { padding: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radiusSm,
    marginBottom: spacing.xs,
  },
  optionSelected: { backgroundColor: colors.primary },
  optionTextContainer: { flex: 1 },
  optionText: { color: colors.text, fontSize: typography.fontBody, fontWeight: typography.weightSemibold },
  optionSubtitle: { color: colors.textLight, fontSize: typography.fontCaption, marginTop: 2 },
  optionTextSelected: { color: colors.white },
});
