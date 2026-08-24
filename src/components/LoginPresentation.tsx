import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadows, spacing, typography } from '../theme';

const LOGO = require('../assets/images/logo.png');

type LoginAction = {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: React.ComponentProps<typeof Ionicons>['name'];
  readonly color?: string;
};

type LoginPresentationProps = {
  readonly email: string;
  readonly password: string;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly busy: boolean;
  readonly error?: string | null;
  readonly subtitle: string;
  readonly note: string;
  readonly submitLabel?: string;
  readonly secondaryActions?: readonly LoginAction[];
  readonly quickActions?: readonly LoginAction[];
  readonly quickActionsLabel?: string;
};

/** Apresentação de login compartilhada; autenticação permanece nos adaptadores. */
export default function LoginPresentation({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  busy,
  error,
  subtitle,
  note,
  submitLabel = 'Entrar',
  secondaryActions = [],
  quickActions = [],
  quickActionsLabel = 'Acessos disponíveis',
}: LoginPresentationProps) {
  const { width, height } = useWindowDimensions();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const scrollRef = React.useRef<ScrollView>(null);
  const emailInputRef = React.useRef<TextInput>(null);
  const passwordInputRef = React.useRef<TextInput>(null);
  const focusedInputRef = React.useRef<React.RefObject<TextInput | null> | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showQuickActions, setShowQuickActions] = React.useState(false);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const isLandscape = width > height;
  const compact = isLandscape || height < 700 || keyboardVisible;

  const scrollFocusedInputIntoView = React.useCallback(
    (inputRef: React.RefObject<TextInput | null>) => {
      const handle = findNodeHandle(inputRef.current);
      if (!handle) return;
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        handle,
        spacing.xl,
        true,
      );
    },
    [],
  );

  const focusInput = React.useCallback((inputRef: React.RefObject<TextInput | null>) => {
    focusedInputRef.current = inputRef;
    setTimeout(
      () => scrollFocusedInputIntoView(inputRef),
      Platform.OS === 'android' ? 180 : 80,
    );
  }, [scrollFocusedInputIntoView]);

  React.useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 12,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fadeAnim, slideAnim]);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      const focused = focusedInputRef.current;
      if (focused) {
        setTimeout(
          () => scrollFocusedInputIntoView(focused),
          Platform.OS === 'android' ? 120 : 0,
        );
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollFocusedInputIntoView]);

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              compact && styles.scrollContentCompact,
              isLandscape && styles.scrollContentLandscape,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          >
            <Animated.View
              style={[
                styles.content,
                isLandscape && styles.contentLandscape,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Image
                source={LOGO}
                style={[styles.logo, compact && styles.logoCompact]}
                resizeMode="contain"
              />
              <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
                {subtitle}
              </Text>
              <Text style={[styles.accessNote, compact && styles.accessNoteCompact]}>
                {note}
              </Text>

              {busy ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Aguarde...</Text>
                </View>
              ) : (
                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                    <TextInput
                      ref={emailInputRef}
                      style={styles.input}
                      placeholder="E-mail"
                      placeholderTextColor={colors.muted}
                      value={email}
                      onChangeText={onEmailChange}
                      onFocus={() => focusInput(emailInputRef)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      disableFullscreenUI
                      returnKeyType="next"
                      blurOnSubmit={false}
                      maxLength={254}
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.input}
                      placeholder="Senha"
                      placeholderTextColor={colors.muted}
                      value={password}
                      onChangeText={onPasswordChange}
                      onFocus={() => focusInput(passwordInputRef)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      disableFullscreenUI
                      returnKeyType="done"
                      maxLength={128}
                      onSubmitEditing={onSubmit}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((current) => !current)}
                      style={styles.eyeButton}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.muted}
                      />
                    </TouchableOpacity>
                  </View>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={onSubmit}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primaryDark]}
                      style={styles.primaryButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="log-in-outline" size={24} color={colors.white} />
                      <Text style={styles.primaryButtonText}>{submitLabel}</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {secondaryActions.length > 0 ? (
                    <View style={styles.secondaryActions}>
                      {secondaryActions.map((action) => (
                        <TouchableOpacity
                          key={action.label}
                          onPress={action.onPress}
                          style={styles.secondaryAction}
                          activeOpacity={0.75}
                        >
                          {action.icon ? (
                            <Ionicons
                              name={action.icon}
                              size={18}
                              color={action.color ?? colors.primary}
                            />
                          ) : null}
                          <Text style={styles.secondaryActionText}>{action.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {quickActions.length > 0 ? (
                    <>
                      <TouchableOpacity
                        onPress={() => setShowQuickActions((current) => !current)}
                        style={styles.quickToggle}
                      >
                        <View style={styles.separator}>
                          <View style={styles.separatorLine} />
                          <Text style={styles.separatorText}>
                            {showQuickActions ? 'Ocultar acessos' : quickActionsLabel}
                          </Text>
                          <View style={styles.separatorLine} />
                        </View>
                      </TouchableOpacity>
                      {showQuickActions ? (
                        <View style={[styles.quickActions, isLandscape && styles.quickActionsLandscape]}>
                          {quickActions.map((action) => (
                            <TouchableOpacity
                              key={action.label}
                              style={[styles.quickAction, isLandscape && styles.quickActionLandscape]}
                              onPress={action.onPress}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name={action.icon ?? 'person-outline'}
                                size={18}
                                color={action.color ?? colors.primary}
                              />
                              <Text style={styles.quickActionText}>{action.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  keyboardAvoidingView: { flex: 1, width: '100%' },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xl,
  },
  scrollContentCompact: { justifyContent: 'flex-start', paddingVertical: spacing.md },
  scrollContentLandscape: { paddingHorizontal: spacing.xl },
  content: { alignItems: 'center', width: '100%', maxWidth: 460 },
  contentLandscape: { maxWidth: 760 },
  logo: { width: 120, height: 120, marginBottom: spacing.xl },
  logoCompact: { width: 72, height: 72, marginBottom: spacing.sm },
  subtitle: {
    fontSize: typography.fontBody + 2,
    color: colors.textLight,
    marginBottom: spacing.md,
    fontWeight: typography.weightSemibold,
    textAlign: 'center',
  },
  subtitleCompact: { marginBottom: spacing.xs },
  accessNote: {
    color: colors.muted,
    fontSize: typography.fontBody - 2,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 400,
  },
  accessNoteCompact: { marginBottom: spacing.md, maxWidth: 560 },
  loadingContainer: { marginTop: spacing.xl, alignItems: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.muted, fontSize: typography.fontBody },
  formContainer: { width: '100%', gap: spacing.md + 2 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: typography.fontBody, color: colors.text },
  eyeButton: { padding: spacing.sm },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.xs },
  errorText: { flex: 1, color: colors.error, fontSize: typography.fontBody - 1 },
  primaryButton: { width: '100%', borderRadius: spacing.radius, overflow: 'hidden', ...shadows.md },
  primaryButtonGradient: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: { color: colors.white, fontWeight: typography.weightBold, fontSize: typography.fontBody + 2 },
  secondaryActions: { gap: spacing.sm },
  secondaryAction: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    paddingHorizontal: spacing.md,
  },
  secondaryActionText: { color: colors.primary, fontSize: typography.fontBody - 1, fontWeight: typography.weightSemibold },
  quickToggle: { marginTop: spacing.xs },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { fontSize: typography.fontBody - 2, color: colors.muted },
  quickActions: { gap: spacing.sm },
  quickActionsLandscape: { flexDirection: 'row' },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: colors.card,
    borderRadius: spacing.radiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionLandscape: { flex: 1 },
  quickActionText: { fontSize: typography.fontBody - 2, color: colors.text, fontWeight: typography.weightSemibold },
});
