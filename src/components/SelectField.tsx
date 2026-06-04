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

export type SelectFieldOption = {
  value: string;
  label: string;
  description?: string;
};

type SelectFieldProps = {
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
}: SelectFieldProps) {
  const [visible, setVisible] = useState(false);
  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
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
          <Text style={[styles.value, !selected ? styles.placeholder : null]} numberOfLines={1}>
            {selected?.label || placeholder}
          </Text>
          {selected?.description ? (
            <Text style={styles.valueDescription} numberOfLines={1}>
              {selected.description}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={disabled ? 'lock-closed-outline' : 'chevron-down-outline'}
          size={20}
          color={colors.muted}
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
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

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.options}>
                {options.map((option) => {
                  const active = option.value === value;
                  return (
                    <TouchableOpacity
                      key={option.value || '__empty__'}
                      style={[styles.option, active ? styles.optionActive : null]}
                      onPress={() => {
                        onChange(option.value);
                        close();
                      }}
                      activeOpacity={0.76}
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
              </View>
            </ScrollView>
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
    backgroundColor: colors.backgroundAlt,
    opacity: 0.76,
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
    ...modalStyles.dialog,
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
