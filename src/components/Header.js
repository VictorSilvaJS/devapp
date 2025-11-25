import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, spacing, border } from '../theme';
import { useAuth } from '../auth/AuthContext';

const LOGO = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b1f9ae8626205b99d179cc/4fe51b90f_Imagem1.png';

export default function Header({ title }) {
  const { user } = useAuth();
  return (
    <View style={styles.container}>
      <Image source={{ uri: LOGO }} style={styles.logo} />
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.userContainer}>
        <Text style={styles.userName} numberOfLines={1}>{user?.full_name || ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.card,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: '#e6f0e6'
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 12,
    borderRadius: border.radius * 0.5
  },
  title: {
    fontSize: typography.fontTitle,
    fontWeight: typography.weightBold,
    color: colors.text
  }
  ,
  userContainer: {
    marginLeft: 'auto'
  },
  userName: {
    fontSize: typography.fontBody,
    color: colors.muted
  }
  ,
  logoutBtn: {
    marginLeft: 12,
    padding: 6
  }
});
