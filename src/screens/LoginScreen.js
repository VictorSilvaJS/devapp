import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthActions } from '../auth/AuthContext';
import { colors, typography, spacing, shadows } from '../theme';

const LOGO = require('../assets/images/logo.png');

export default function LoginScreen({ navigation }) {
  const { login, loading } = useAuthActions();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

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

  const handleLogin = async (key) => {
    try {
      await login(key);
    } catch (err) {
      alert('Erro ao autenticar');
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Tchê Agro</Text>
        <Text style={styles.subtitle}>Faça login como</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Aguarde...</Text>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={[styles.btn, styles.btnAdmin]} 
              onPress={() => handleLogin('admin')} 
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="briefcase-outline" size={22} color="#FFFFFF" style={styles.btnIcon} />
                <Text style={styles.btnText}>Admin</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, styles.btnColaborador]} 
              onPress={() => handleLogin('colaborador')} 
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.secondary, colors.secondaryLight]}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="hammer-outline" size={22} color="#FFFFFF" style={styles.btnIcon} />
                <Text style={styles.btnText}>Colaborador</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, styles.btnCliente]} 
              onPress={() => handleLogin('cliente')} 
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.success, colors.successLight]}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="leaf-outline" size={22} color="#FFFFFF" style={styles.btnIcon} />
                <Text style={styles.btnText}>Cliente</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: spacing.screen * 2
  },
  content: {
    alignItems: 'center',
    width: '100%'
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: spacing.gap * 2
  },
  title: { 
    fontSize: typography.fontTitle + 4, 
    fontWeight: typography.weightBold, 
    color: colors.text, 
    marginBottom: 8 
  },
  subtitle: { 
    fontSize: typography.fontBody + 2, 
    color: colors.textLight, 
    marginBottom: spacing.gap * 3,
    fontWeight: typography.weightSemibold
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
  buttonsContainer: {
    width: '100%',
    gap: spacing.gap + 4
  },
  btn: { 
    width: '100%', 
    borderRadius: 14,
    overflow: 'hidden',
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
  btnAdmin: {},
  btnColaborador: {},
  btnCliente: {},
  btnText: { 
    color: '#fff', 
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody + 2
  }
});
