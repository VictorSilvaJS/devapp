import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { colors, inputStyles, modalStyles, semanticColors, spacing, typography } from '../theme';
import FormField from './FormField';
import { VisualPrivacyBoundary } from './VisualPrivacyBoundary';
import SelectFieldViewport from './SelectFieldViewport';

export type SelectFieldOption = {
  value: string;
  label: string;
  description?: string;
};

export type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectFieldOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  selectedOption?: SelectFieldOption;
  remote?: {
    search?: string; onSearch?: (value: string) => void;
    loading: boolean; loadingMore?: boolean; error?: string;
    onRetry?: () => void; onLoadMore?: () => void;
  };
};

export default function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione uma opção',
  helperText,
  error,
  required = false,
  disabled = false,
  accessibilityLabel,
  selectedOption,
  remote,
}: SelectFieldProps) {
  const [visible, setVisible] = useState(false);
  const selected = useMemo(
    () => selectedOption?.value === value ? selectedOption : options.find((option) => option.value === value),
    [options, value, selectedOption]
  );

  const close = () => setVisible(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <TouchableOpacity
        style={[
          styles.field,
          error ? styles.fieldError : null,
          disabled ? styles.fieldDisabled : null,
        ]}
        onPress={() => setVisible(true)}
        disabled={disabled}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={disabled ? 'Campo somente leitura' : 'Abre a lista de opções'}
      >
        <View style={styles.fieldText}>
          <Text style={[styles.value, !selected ? styles.placeholder : null, disabled ? styles.valueDisabled : null]} numberOfLines={1}>
            {selected?.label || placeholder}
          </Text>
          {selected?.description ? (
            <Text style={[styles.valueDescription, disabled ? styles.valueDisabled : null]} numberOfLines={1}>
              {selected.description}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={disabled ? 'lock-closed-outline' : 'chevron-down-outline'}
          size={20}
          color={disabled ? semanticColors.disabled.text : colors.muted}
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <VisualPrivacyBoundary style={{ flex: 1 }}>
        <SelectFieldViewport>
        <Pressable style={modalStyles.overlay as ViewStyle} onPress={close}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <View style={styles.header}>
              <Text style={styles.title}>{label}</Text>
              <TouchableOpacity
                style={modalStyles.closeButton as ViewStyle}
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Fechar opções"
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.list} showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
              {remote?.onSearch ? <FormField label={`Buscar ${label}`} accessibilityLabel={`Buscar ${label}`}
                value={remote.search ?? ''} onChangeText={remote.onSearch} disabled={disabled}
                disableFullscreenUI returnKeyType="search" /> : null}
              <View style={styles.options}>
                {remote?.loading ? <><ActivityIndicator color={colors.primary} /><Text>Carregando opções...</Text></> : null}
                {remote && !remote.loading && options.length === 0 && !remote.error ? <Text>Nenhuma opção encontrada.</Text> : null}
                {remote?.error ? <Text accessibilityLiveRegion="polite">{remote.error}</Text> : null}
                {remote?.error && remote.onRetry ? <TouchableOpacity accessibilityRole="button"
                  accessibilityLabel={`Tentar novamente ${label}`} style={styles.option} disabled={disabled}
                  onPress={remote.onRetry}><Text>Tentar novamente</Text></TouchableOpacity> : null}
                {options.map((option) => {
                  const active = option.value === value;
                  return (
                    <TouchableOpacity
                      key={option.value || '__empty__'}
                      style={[styles.option, active ? styles.optionActive : null]}
                      onPress={() => {
                        if (disabled) return;
                        onChange(option.value);
                        close();
                      }}
                      activeOpacity={0.76}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                    >
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={active ? colors.primary : colors.muted}
                      />
                      <View style={styles.optionText}>
                        <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                          {option.label}
                        </Text>
                        {option.description ? (
                          <Text style={styles.optionDescription}>{option.description}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {remote?.loadingMore ? <><ActivityIndicator color={colors.primary} /><Text>Carregando mais opções...</Text></> : null}
                {remote?.onLoadMore ? <TouchableOpacity accessibilityRole="button" style={styles.option}
                  accessibilityLabel={`Carregar mais ${label}`} disabled={disabled || remote.loadingMore}
                  onPress={remote.onLoadMore}><Text>Carregar mais</Text></TouchableOpacity> : null}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
        </SelectFieldViewport>
        </VisualPrivacyBoundary>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexShrink: 1, minHeight: 0 },
  container: {
    ...inputStyles.container,
  },
  label: {
    ...inputStyles.label,
  },
  required: {
    color: colors.error,
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
  fieldError: {
    borderColor: colors.error,
  },
  fieldDisabled: {
    backgroundColor: semanticColors.disabled.surface,
    borderColor: semanticColors.disabled.border,
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
    color: semanticColors.disabled.text,
  },
  placeholder: {
    color: colors.muted,
    fontWeight: typography.weightRegular,
  },
  valueDescription: {
    color: colors.textSecondary,
    fontSize: typography.fontSmall,
    marginTop: 2,
  },
  errorText: {
    ...inputStyles.errorText,
  },
  helperText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.fontSmall,
    lineHeight: 16,
  },
  dialog: {
    ...(modalStyles.dialog as ViewStyle),
    maxHeight: '80%',
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    ...(modalStyles.header as ViewStyle),
  },
  title: {
    ...modalStyles.title,
    flex: 1,
    marginRight: spacing.sm,
  },
  options: {
    padding: spacing.md,
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
  optionActive: {
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
  optionLabelActive: {
    color: colors.primaryDark,
    fontWeight: typography.weightBold,
  },
  optionDescription: {
    color: colors.textSecondary,
    fontSize: typography.fontSmall,
    lineHeight: 16,
    marginTop: 2,
  },
});
