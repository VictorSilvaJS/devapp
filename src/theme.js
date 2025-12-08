export const colors = {
  primary: '#228B22',
  primaryDark: '#1a6b1a',
  primaryLight: '#2fa82f',
  secondary: '#8B6244',
  secondaryLight: '#a17757',
  accent: '#d9ead3',
  accentDark: '#b6d7a8',
  background: '#F8FBF8',
  backgroundAlt: '#f7f9f7',
  card: '#FFFFFF',
  cardHover: '#f0f7f0',
  text: '#1C3D1C',
  textLight: '#4a5c4a',
  muted: '#6B7280',
  mutedLight: '#9ca3af',
  success: '#10B981',
  successLight: '#34d399',
  warning: '#F59E0B',
  warningLight: '#fbbf24',
  error: '#EF4444',
  errorLight: '#f87171',
  border: '#d9ead3',
  borderLight: '#e8f5e8',
  shadow: 'rgba(34, 139, 34, 0.15)',
  shadowDark: 'rgba(0, 0, 0, 0.1)',
  // Gradientes
  gradientStart: 'rgba(139, 98, 68, 0.05)',
  gradientMid: 'rgba(255, 255, 255, 0.95)',
  gradientEnd: 'rgba(34, 139, 34, 0.05)'
};

export const spacing = {
  screen: 16,
  card: 12,
  gap: 12,
  radius: 12,
  radiusLg: 16,
  radiusSm: 8
};

export const typography = {
  // Ajustes finos de tipografia para mobile
  fontTitle: 28,       // títulos principais
  fontSubtitle: 20,    // subtítulos e estatísticas
  fontBody: 16,        // texto padrão do app
  fontCaption: 12,     // legendas e textos pequenos
  fontSmall: 11,       // textos muito pequenos
  weightBold: '700',
  weightSemibold: '600',
  weightRegular: '400',
  weightLight: '300'
};

export const border = {
  radius: 12,
  radiusLg: 16,
  radiusSm: 8
};

export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  lg: {
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6
  }
};
