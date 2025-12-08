import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthActions } from '../auth/AuthContext';
import { colors, typography, spacing } from '../theme';

export default function LoginScreen({ navigation }) {
  const { login, loading } = useAuthActions();

  const handleLogin = async (key) => {
    try {
      await login(key);
    } catch (err) {
      alert('Erro ao autenticar');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tchê Agro</Text>
      <Text style={styles.subtitle}>Faça login como</Text>

      {loading ? (
        <View style={{ marginTop: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.muted }}>Aguarde...</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => handleLogin('admin')} disabled={loading}>
            <Text style={styles.btnText}>Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.secondary }]} onPress={() => handleLogin('colaborador')} disabled={loading}>
            <Text style={styles.btnText}>Colaborador</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#0ea5a0' }]} onPress={() => handleLogin('cliente')} disabled={loading}>
            <Text style={styles.btnText}>Cliente</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.background, padding: spacing.screen },
  title: { fontSize: typography.fontTitle, fontWeight: typography.weightBold, color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: typography.fontBody, color: colors.muted, marginBottom: 16 },
  btn: { width: '80%', padding: 12, borderRadius: 10, alignItems:'center', marginVertical:6 },
  btnText: { color: '#fff', fontWeight: typography.weightSemibold }
});
