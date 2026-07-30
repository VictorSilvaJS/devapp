import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthActions } from '../auth/AuthContext';
import { AUTH_LOCAL_USER_NOT_FOUND_MESSAGE } from '../auth/authLocal';
import {
  AUTH_INACTIVE_ACCESS_MESSAGE,
  AUTH_PENDING_ACCESS_MESSAGE,
  AUTH_UNKNOWN_STATUS_MESSAGE,
} from '../auth/authStatus';
import { colors, typography, spacing, shadows } from '../theme';

const LOGO = require('../assets/images/logo.png');
const CONTROLLED_LOGIN_MESSAGES = [
  AUTH_LOCAL_USER_NOT_FOUND_MESSAGE,
  AUTH_PENDING_ACCESS_MESSAGE,
  AUTH_INACTIVE_ACCESS_MESSAGE,
  AUTH_UNKNOWN_STATUS_MESSAGE,
];

export default function LoginScreen({ navigation }) {
  const { login, loginRapido, loading } = useAuthActions();
  const { width, height } = useWindowDimensions();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const scrollRef = React.useRef<ScrollView>(null);
  const emailInputRef = React.useRef<TextInput>(null);
  const senhaInputRef = React.useRef<TextInput>(null);
  const focusedInputRef = React.useRef<React.RefObject<TextInput | null> | null>(null);
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [mostrarSenha, setMostrarSenha] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [modoAcessoRapido, setModoAcessoRapido] = React.useState(false);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const isLandscape = width > height;
  const isCompactLayout = isLandscape || height < 700 || keyboardVisible;

  const scrollFocusedInputIntoView = React.useCallback(
    (inputRef: React.RefObject<TextInput | null>) => {
      const inputHandle = findNodeHandle(inputRef.current);

      if (!inputHandle) return;

      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        inputHandle,
        spacing.xl,
        true
      );
    },
    []
  );

  const handleInputFocus = React.useCallback(
    (inputRef: React.RefObject<TextInput | null>) => {
      focusedInputRef.current = inputRef;
      setTimeout(() => scrollFocusedInputIntoView(inputRef), Platform.OS === 'android' ? 180 : 80);
    },
    [scrollFocusedInputIntoView]
  );

  React.useEffect(() => {
    Animated.parallel([
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
      })
    ]).start();
  }, []);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);

      const inputRef = focusedInputRef.current;
      if (inputRef) {
        setTimeout(
          () => scrollFocusedInputIntoView(inputRef),
          Platform.OS === 'android' ? 120 : 0
        );
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollFocusedInputIntoView]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (keyboardVisible && focusedInputRef.current) {
        scrollFocusedInputIntoView(focusedInputRef.current);
        return;
      }

      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 120);

    return () => clearTimeout(timer);
  }, [height, keyboardVisible, scrollFocusedInputIntoView, width]);

  const handleLogin = async () => {
    setErro('');
    if (!email.trim()) {
      setErro('Informe o e-mail');
      return;
    }
    if (!senha) {
      setErro('Informe a senha');
      return;
    }
    try {
      await login(email.trim(), senha);
      // Direcionamento automático - sem escolha de perfil
      // O próprio navigation cuida de redirecionar baseado no user.perfil
    } catch (err) {
      const message = String(err?.message || '');

      setErro(CONTROLLED_LOGIN_MESSAGES.includes(message) ? message : 'E-mail ou senha inválidos');
    }
  };

  const handleAcessoRapido = async (key) => {
    setErro('');
    try {
      await loginRapido(key);
    } catch (err) {
      const message = String(err?.message || '');
      setErro(
        CONTROLLED_LOGIN_MESSAGES.includes(message)
          ? message
          : 'Não foi possível iniciar o acesso demonstrativo'
      );
    }
  };

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
              isCompactLayout && styles.scrollContentCompact,
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
                style={[styles.logo, isCompactLayout && styles.logoCompact]}
                resizeMode="contain"
              />
              <Text style={[styles.subtitle, isCompactLayout && styles.subtitleCompact]}>
                Acesso demonstrativo local
              </Text>
              <Text style={[styles.accessNote, isCompactLayout && styles.accessNoteCompact]}>
                Use credenciais locais cadastradas no Admin ou os acessos demonstrativos. Este acesso não representa autenticação de produção.
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Aguarde...</Text>
                </View>
              ) : (
                <View style={styles.formContainer}>
                  {/* Campo Email */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                    <TextInput
                      ref={emailInputRef}
                      style={styles.input}
                      placeholder="E-mail"
                      placeholderTextColor={colors.muted}
                      value={email}
                      onChangeText={(t) => { setEmail(t); setErro(''); }}
                      onFocus={() => handleInputFocus(emailInputRef)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      disableFullscreenUI
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => senhaInputRef.current?.focus()}
                    />
                  </View>

                  {/* Campo Senha */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                    <TextInput
                      ref={senhaInputRef}
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Senha"
                      placeholderTextColor={colors.muted}
                      value={senha}
                      onChangeText={(t) => { setSenha(t); setErro(''); }}
                      onFocus={() => handleInputFocus(senhaInputRef)}
                      secureTextEntry={!mostrarSenha}
                      autoCapitalize="none"
                      disableFullscreenUI
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={styles.eyeButton}>
                      <Ionicons name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>

                  {/* Mensagem de erro */}
                  {erro ? (
                    <View style={styles.erroContainer}>
                      <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                      <Text style={styles.erroText}>{erro}</Text>
                    </View>
                  ) : null}

                  {/* Botão Entrar */}
                  <TouchableOpacity
                    style={styles.btn}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primaryDark]}
                      style={styles.btnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="log-in-outline" size={24} color={colors.white} style={styles.btnIcon} />
                      <Text style={styles.btnText}>Entrar na demonstração</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setModoAcessoRapido(!modoAcessoRapido)}
                    style={styles.acessoRapidoToggle}
                  >
                    <View style={styles.separador}>
                      <View style={styles.separadorLinha} />
                      <Text style={styles.separadorTexto}>
                        {modoAcessoRapido ? 'Ocultar acesso rápido' : 'Acesso rápido para demonstração'}
                      </Text>
                      <View style={styles.separadorLinha} />
                    </View>
                  </TouchableOpacity>

                  {modoAcessoRapido && (
                    <View
                      style={[
                        styles.acessoRapidoButtonsContainer,
                        isLandscape && styles.acessoRapidoButtonsContainerLandscape,
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.acessoRapidoBtn,
                          isLandscape
                            ? styles.acessoRapidoBtnLandscape
                            : styles.acessoRapidoBtnPortrait,
                        ]}
                        onPress={() => handleAcessoRapido('admin')}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                        <Text style={styles.acessoRapidoBtnText}>Admin Demonstração</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.acessoRapidoBtn,
                          isLandscape
                            ? styles.acessoRapidoBtnLandscape
                            : styles.acessoRapidoBtnPortrait,
                        ]}
                        onPress={() => handleAcessoRapido('colaborador')}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="people-outline" size={18} color={colors.secondary} />
                        <Text style={styles.acessoRapidoBtnText}>Colaborador de Campo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.acessoRapidoBtn,
                          isLandscape
                            ? styles.acessoRapidoBtnLandscape
                            : styles.acessoRapidoBtnPortrait,
                        ]}
                        onPress={() => handleAcessoRapido('produtor')}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="leaf-outline" size={18} color={colors.success} />
                        <Text style={styles.acessoRapidoBtnText}>Produtor Demonstração</Text>
                      </TouchableOpacity>
                    </View>
                  )}
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
  container: { 
    flex: 1, 
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xl,
  },
  scrollContentCompact: {
    justifyContent: 'flex-start',
    paddingVertical: spacing.md,
  },
  scrollContentLandscape: {
    paddingHorizontal: spacing.xl,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 460,
  },
  contentLandscape: {
    maxWidth: 760,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.gap * 2,
  },
  logoCompact: {
    width: 72,
    height: 72,
    marginBottom: spacing.sm,
  },
  subtitle: { 
    fontSize: typography.fontBody + 2, 
    color: colors.textLight, 
    marginBottom: spacing.gap,
    fontWeight: typography.weightSemibold
  },
  subtitleCompact: {
    marginBottom: spacing.xs,
  },
  accessNote: {
    color: colors.muted,
    fontSize: typography.fontBody - 2,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.gap * 3,
    maxWidth: 360,
  },
  accessNoteCompact: {
    marginBottom: spacing.md,
    maxWidth: 560,
  },
  loadingContainer: {
    marginTop: spacing.gap * 2,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: spacing.gap,
    color: colors.muted,
    fontSize: typography.fontBody
  },
  formContainer: {
    width: '100%',
    gap: spacing.gap + 2,
  },
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
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: typography.fontBody,
    color: colors.text,
  },
  eyeButton: {
    padding: 8,
  },
  erroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  erroText: {
    color: colors.error,
    fontSize: typography.fontBody - 1,
  },
  btn: { 
    width: '100%', 
    borderRadius: spacing.radius,
    overflow: 'hidden',
    marginTop: 4,
    ...shadows.md
  },
  btnGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  btnIcon: {
    marginRight: 2
  },
  btnText: { 
    color: colors.white, 
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody + 2
  },
  acessoRapidoToggle: {
    marginTop: 8,
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  separadorLinha: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separadorTexto: {
    fontSize: typography.fontBody - 2,
    color: colors.muted,
  },
  acessoRapidoButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  acessoRapidoButtonsContainerLandscape: {
    flexWrap: 'nowrap',
  },
  acessoRapidoBtn: {
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
  acessoRapidoBtnPortrait: {
    width: '100%',
  },
  acessoRapidoBtnLandscape: {
    width: '32%',
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  acessoRapidoBtnText: {
    fontSize: typography.fontBody - 2,
    color: colors.text,
    fontWeight: typography.weightSemibold,
  },
});
