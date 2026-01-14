import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, shadows } from '../theme';

/**
 * Campo de input reutilizável com validação visual
 * @param {Object} props
 * @param {string} props.label - Rótulo do campo
 * @param {string} props.value - Valor atual
 * @param {function} props.onChangeText - Callback de mudança
 * @param {string} props.placeholder - Placeholder
 * @param {boolean} props.required - Campo obrigatório
 * @param {string} props.error - Mensagem de erro
 * @param {boolean} props.valid - Campo válido
 * @param {string} props.icon - Nome do ícone Ionicons
 * @param {string} props.keyboardType - Tipo de teclado
 * @param {boolean} props.secureTextEntry - Campo de senha
 * @param {boolean} props.multiline - Múltiplas linhas
 * @param {number} props.maxLength - Tamanho máximo
 */
export default function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  error = '',
  valid = false,
  icon,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
  maxLength,
  autoCapitalize = 'sentences',
  editable = true,
  onBlur,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasValue = value && value.length > 0;
  const showError = error && error.length > 0 && !isFocused;
  const showValid = valid && hasValue && !isFocused && !error;

  const getBorderColor = () => {
    if (showError) return colors.danger;
    if (showValid) return colors.success;
    if (isFocused) return colors.primary;
    return colors.border;
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor() },
          isFocused && styles.inputFocused,
          !editable && styles.inputDisabled,
        ]}
      >
        {/* Ícone à esquerda */}
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? colors.primary : colors.muted}
            style={styles.iconLeft}
          />
        )}

        {/* Input */}
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedLight}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur && onBlur();
          }}
        />

        {/* Ícone de senha */}
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.iconRight}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.muted}
            />
          </TouchableOpacity>
        )}

        {/* Ícone de validação */}
        {!secureTextEntry && showValid && (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={colors.success}
            style={styles.iconRight}
          />
        )}

        {!secureTextEntry && showError && (
          <Ionicons
            name="alert-circle"
            size={20}
            color={colors.danger}
            style={styles.iconRight}
          />
        )}
      </View>

      {/* Mensagem de erro */}
      {showError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Contador de caracteres */}
      {maxLength && hasValue && (
        <Text style={styles.counter}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    ...shadows.sm,
  },
  inputFocused: {
    ...shadows.md,
  },
  inputDisabled: {
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
    padding: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontCaption,
    color: colors.danger,
    fontWeight: typography.weightMedium,
  },
  counter: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
});
