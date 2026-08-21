import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../theme';
import { safeClientErrorMessage } from './errorMessages';

export function HttpScreen({
  children,
  scroll = true,
}: React.PropsWithChildren<{ readonly scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function HttpTitle({ children }: React.PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function HttpParagraph({ children }: React.PropsWithChildren) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function HttpField({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  placeholder,
  maxLength,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly placeholder?: string;
  readonly maxLength?: number;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        maxLength={maxLength}
      />
    </View>
  );
}

export function HttpButton({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
}: {
  readonly title: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.buttonSecondaryText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function HttpFeedback({
  message,
  kind = 'error',
}: {
  readonly message?: string | null;
  readonly kind?: 'error' | 'success' | 'info';
}) {
  if (!message) return null;
  return (
    <View
      style={[
        styles.feedback,
        kind === 'success' && styles.feedbackSuccess,
        kind === 'info' && styles.feedbackInfo,
      ]}
    >
      <Text style={styles.feedbackText}>{message}</Text>
    </View>
  );
}

export function HttpBusy({ label = 'Aguarde...' }: { readonly label?: string }) {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.paragraph}>{label}</Text>
    </View>
  );
}

export function controlledUiError(error: unknown): string {
  return safeClientErrorMessage(error);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.screen },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.screen,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  paragraph: {
    color: colors.textLight,
    fontSize: typography.fontBody,
    lineHeight: 22,
  },
  fieldGroup: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontBody,
  },
  button: {
    minHeight: 50,
    borderRadius: spacing.radius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  buttonDanger: { backgroundColor: colors.error },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonSecondaryText: { color: colors.primaryDark },
  feedback: {
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.errorBgLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  feedbackSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  feedbackInfo: {
    backgroundColor: colors.infoLight,
    borderColor: colors.info,
  },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  busy: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
