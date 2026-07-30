export const colors = {
  primary: '#1F7A1F',
  primaryDark: '#155E15',
  primaryLight: '#E4F3E1',
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
  textSecondary: '#6B7280',
  muted: '#6B7280',
  mutedLight: '#64748B',
  success: '#047857',
  successLight: '#34d399',
  warning: '#B45309',
  warningLight: '#fbbf24',
  error: '#C02626',
  errorLight: '#f87171',
  danger: '#C02626',       // alias para error (compatibilidade)
  dangerLight: '#f87171',  // alias para errorLight
  white: '#FFFFFF',
  black: '#000000',
  border: '#d9ead3',
  borderLight: '#e8f5e8',
  borderMedium: '#E8EEF2',
  shadow: 'rgba(34, 139, 34, 0.15)',
  shadowDark: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  // Cores semânticas para categorias/tipos
  info: '#1D4ED8',
  infoLight: '#dbeafe',
  purple: '#6D28D9',
  purpleLight: '#ede9fe',
  amber: '#B45309',
  amberLight: '#fef3c7',
  cyan: '#0E7490',
  cyanLight: '#cffafe',
  orange: '#C2410C',
  orangeLight: '#fff7ed',
  // Gradientes
  gradientStart: 'rgba(139, 98, 68, 0.05)',
  gradientMid: 'rgba(255, 255, 255, 0.95)',
  gradientEnd: 'rgba(34, 139, 34, 0.05)',
  // FAB padrão
  fab: '#228B22',
  fabDark: '#1a6b1a',
  fabShadow: '#1a6b1a',
  // Fundos semânticos para StatCards e métricas
  secondaryBg: '#f5f3f0',
  successBg: '#d1fae5',
  backgroundNeutral: '#F5F7FA',
  backgroundSoft: '#F9FAFB',
  whiteTranslucent: 'rgba(255, 255, 255, 0.8)',
  // Cores de destaque para filtros
  coral: '#FF6B6B',
  teal: '#4ECDC4',
  // Fundos de erro/danger
  errorBgLight: '#FFF5F5',
  errorBgMedium: '#FFE5E5',
  errorBorder: '#FFD6D6',
  disabledSurface: '#E2E8F0',
  disabledText: '#475569',
  disabledBorder: '#64748B',
};

export const semanticColors = {
  primary: {
    surface: colors.primaryLight,
    text: colors.primary,
    border: colors.primary,
  },
  success: {
    surface: colors.successBg,
    text: colors.success,
    border: colors.success,
  },
  warning: {
    surface: colors.amberLight,
    text: colors.warning,
    border: colors.warning,
  },
  info: {
    surface: colors.infoLight,
    text: colors.info,
    border: colors.info,
  },
  error: {
    surface: colors.errorBgLight,
    text: colors.error,
    border: colors.error,
  },
  disabled: {
    surface: colors.disabledSurface,
    text: colors.disabledText,
    border: colors.disabledBorder,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
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
  weightMedium: '500',
  weightRegular: '400',
  weightLight: '300',
  // Tamanhos padronizados
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 28
  }
} as const;

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
  // Aliases para compatibilidade
  small: {
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
  medium: {
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
  },
  large: {
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6
  }
};

/**
 * ==============================
 * DESIGN TOKENS PADRONIZADOS
 * ==============================
 * Usar estes tokens em TODOS os componentes para manter consistência.
 */

// Tamanhos padronizados de ícones
export const iconSizes = {
  xs: 14,    // meta/detalhes inline
  sm: 16,    // info secundária, badges
  md: 20,    // ícones padrão em botões/inputs
  lg: 24,    // ícones de ação principal
  xl: 32,    // ícones de destaque em cards
  xxl: 48,   // ícones de seção/hero
  empty: 80, // empty state illustrations
};

// Estilos de overlay de modal padronizados
export const modalStyles = {
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...{
      shadowColor: colors.shadowDark,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6
    },
  },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    ...{
      shadowColor: colors.shadowDark,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8
    },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
};

// Estilos padronizados para botões
export const buttonStyles = {
  // Botão primário (ação principal)
  primary: {
    backgroundColor: colors.primary,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  // Botão secundário (cancelar, voltar)
  secondary: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },
  // Botão de perigo (excluir)
  danger: {
    backgroundColor: colors.error,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  dangerText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  // Chip/Tag toggle
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
  },
  // Disabled
  disabled: {
    backgroundColor: semanticColors.disabled.surface,
    borderColor: semanticColors.disabled.border,
  },
  disabledText: {
    color: semanticColors.disabled.text,
  },
};

// Estilos padronizados para cards
export const cardStyles = {
  base: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: spacing.card + 2,
    ...{
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2
    },
  },
  elevated: {
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    ...{
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4
    },
  },
};

// FAB (Floating Action Button) padronizado
export const fabStyles = {
  container: {
    position: 'absolute',
    right: spacing.screen,
    bottom: spacing.screen + 20,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: colors.fabShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  gradient: [colors.primary, colors.primaryDark, colors.fabDark],
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  icon: {
    color: colors.white,
    size: 24,
  },
  text: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
};

// Estilos padronizados para empty states
export const emptyStateStyles = {
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
};

// Estilos padronizados para badges/status
export const badgeStyles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weightBold,
    letterSpacing: 0.3,
  },
};

// Estilos padronizados para inputs
export const inputStyles = {
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  field: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontBody,
    color: colors.text,
    minHeight: 48,
  },
  fieldFocused: {
    borderColor: colors.primary,
  },
  fieldError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: typography.fontSmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
};

// Estilos padronizados para barra de busca
export const searchBarStyles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
  },
};

export default {
  colors,
  semanticColors,
  spacing,
  typography,
  border,
  shadows,
  iconSizes,
  modalStyles,
  buttonStyles,
  cardStyles,
  fabStyles,
  emptyStateStyles,
  badgeStyles,
  inputStyles,
  searchBarStyles,
};
