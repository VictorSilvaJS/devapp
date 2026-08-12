import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, inputStyles, modalStyles, spacing, typography } from '../theme';
import SearchBar from './SearchBar';

export type MultiSelectFieldOption = {
  value: string;
  label: string;
  description?: string;
};

type MultiSelectFieldProps = {
  label: string;
  values: string[];
  options: MultiSelectFieldOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  helperText?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
};

const normalizarBusca = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

export default function MultiSelectField({
  label,
  values,
  options,
  onChange,
  placeholder = 'Nenhum item selecionado',
  helperText,
  emptyText = 'Nenhuma opção encontrada.',
  searchPlaceholder = 'Buscar...',
  disabled = false,
  accessibilityLabel,
}: MultiSelectFieldProps) {
  const [visible, setVisible] = useState(false);
  const [busca, setBusca] = useState('');
  const selectedValues = useMemo(() => new Set(values), [values]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedValues.has(option.value)),
    [options, selectedValues],
  );
  const filteredOptions = useMemo(() => {
    const termo = normalizarBusca(busca);
    if (!termo) return options;

    return options.filter((option) => normalizarBusca(
      [option.label, option.description].filter(Boolean).join(' '),
    ).includes(termo));
  }, [busca, options]);

  const close = () => {
    setVisible(false);
    setBusca('');
  };

  const toggle = (value: string) => {
    onChange(
      selectedValues.has(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };

  const summary = selectedOptions.length === 0
    ? placeholder
    : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} itens selecionados`;
  const selectedNames = selectedOptions.length > 1
    ? selectedOptions.map((option) => option.label).join(', ')
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.field, disabled ? styles.fieldDisabled : null]}
        onPress={() => setVisible(true)}
        disabled={disabled}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={disabled ? 'Campo indisponível' : 'Abre a seleção de vários itens'}
      >
        <View style={styles.fieldText}>
          <Text
            style={[
              styles.value,
              selectedOptions.length === 0 ? styles.placeholder : null,
              disabled ? styles.valueDisabled : null,
            ]}
            numberOfLines={1}
          >
            {summary}
          </Text>
          {selectedNames ? (
            <Text style={styles.valueDescription} numberOfLines={2}>{selectedNames}</Text>
          ) : null}
        </View>
        <Ionicons
          name={disabled ? 'lock-closed-outline' : 'people-outline'}
          size={20}
          color={disabled ? colors.muted : colors.primary}
        />
      </TouchableOpacity>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={modalStyles.overlay as ViewStyle} onPress={close}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{label}</Text>
                <Text style={styles.selectionCount} accessibilityLiveRegion="polite">
                  {selectedOptions.length === 0
                    ? 'Nenhum selecionado'
                    : `${selectedOptions.length} selecionado${selectedOptions.length === 1 ? '' : 's'}`}
                </Text>
              </View>
              <TouchableOpacity
                style={modalStyles.closeButton as ViewStyle}
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Fechar seleção"
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchArea}>
              <SearchBar
                value={busca}
                onChangeText={setBusca}
                onClear={() => setBusca('')}
                placeholder={searchPlaceholder}
                autoCapitalize="none"
                accessibilityLabel={`Buscar em ${label}`}
              />
            </View>

            <ScrollView
              style={styles.optionsScroll}
              contentContainerStyle={styles.options}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {filteredOptions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={26} color={colors.muted} />
                  <Text style={styles.emptyText}>{emptyText}</Text>
                </View>
              ) : filteredOptions.map((option) => {
                const selected = selectedValues.has(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, selected ? styles.optionSelected : null]}
                    onPress={() => toggle(option.value)}
                    activeOpacity={0.76}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={option.label}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.muted}
                    />
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={close}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark" size={20} color={colors.white} />
                <Text style={styles.doneButtonText}>Concluir seleção</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...inputStyles.container,
  },
  label: {
    ...inputStyles.label,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  fieldDisabled: {
    opacity: 0.65,
  },
  fieldText: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },
  valueDisabled: {
    color: colors.muted,
  },
  placeholder: {
    color: colors.muted,
    fontWeight: typography.weightRegular,
  },
  valueDescription: {
    color: colors.textSecondary,
    fontSize: typography.fontSmall,
    lineHeight: 16,
    marginTop: 2,
  },
  helperText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.fontSmall,
    lineHeight: 16,
  },
  dialog: {
    ...(modalStyles.dialog as ViewStyle),
    maxHeight: '88%',
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    ...(modalStyles.header as ViewStyle),
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  title: {
    ...modalStyles.title,
  },
  selectionCount: {
    color: colors.muted,
    fontSize: typography.fontSmall,
    marginTop: 2,
  },
  searchArea: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  optionsScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  options: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: spacing.radius,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },
  optionLabelSelected: {
    color: colors.primaryDark,
    fontWeight: typography.weightBold,
  },
  optionDescription: {
    color: colors.textSecondary,
    fontSize: typography.fontSmall,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.fontBody,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  doneButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: spacing.radius,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
});
