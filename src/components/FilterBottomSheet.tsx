import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type ActiveFilterItem = {
  key: string;
  label: string;
  icon?: IconName;
  color?: string;
  onRemove: () => void;
};

type FilterBottomSheetProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onRequestClose: () => void;
  onClear: () => void;
  onApply: () => void;
  clearLabel?: string;
  applyLabel?: string;
  testID?: string;
};

type FilterTriggerProps = {
  onPress: () => void;
  activeCount?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

type ActiveFilterBarProps = {
  items: ActiveFilterItem[];
  onClear: () => void;
  title?: string;
  clearLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type FilterSectionProps = {
  title: string;
  children: ReactNode;
};

export function FilterTrigger({
  onPress,
  activeCount = 0,
  label = 'Filtros',
  style,
}: FilterTriggerProps) {
  const active = activeCount > 0;

  return (
    <TouchableOpacity
      style={[styles.trigger, style]}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={active ? `${label}, ${activeCount} ativos` : label}
    >
      <LinearGradient
        colors={active
          ? [colors.primary, colors.primaryDark]
          : [colors.white, colors.backgroundSoft]}
        style={styles.triggerGradient}
      >
        <Ionicons
          name="options"
          size={20}
          color={active ? colors.white : colors.primary}
        />
        <Text style={[styles.triggerText, active && styles.triggerTextActive]}>
          {label}
        </Text>
        {active ? (
          <View style={styles.triggerBadge}>
            <Text style={styles.triggerBadgeText}>{activeCount}</Text>
          </View>
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function ActiveFilterBar({
  items,
  onClear,
  title = 'Filtros ativos:',
  clearLabel = 'Limpar',
  style,
}: ActiveFilterBarProps) {
  if (items.length === 0) return null;

  return (
    <View style={[styles.activeBar, style]}>
      <View style={styles.activeBarHeader}>
        <Ionicons name="funnel" size={14} color={colors.textLight} />
        <Text style={styles.activeBarTitle}>{title}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.activeBarContent}
      >
        {items.map((item) => {
          const itemColor = item.color || colors.primary;
          return (
            <LinearGradient
              key={item.key}
              colors={[colors.white, colors.backgroundSoft]}
              style={styles.activeChip}
            >
              {item.icon ? (
                <View style={[styles.activeChipIcon, { backgroundColor: `${itemColor}20` }]}>
                  <Ionicons name={item.icon} size={16} color={itemColor} />
                </View>
              ) : null}
              <Text style={styles.activeChipText}>{item.label}</Text>
              <TouchableOpacity
                onPress={item.onRemove}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.removeChipButton}
                accessibilityRole="button"
                accessibilityLabel={`Remover filtro ${item.label}`}
              >
                <Ionicons name="close" size={16} color={colors.textLight} />
              </TouchableOpacity>
            </LinearGradient>
          );
        })}
        <TouchableOpacity
          style={styles.clearChip}
          onPress={onClear}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Limpar todos os filtros ativos"
        >
          <Ionicons name="refresh" size={16} color={colors.error} />
          <Text style={styles.clearChipText}>{clearLabel}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function FilterBottomSheet({
  visible,
  title = 'Filtros e Ordenação',
  subtitle,
  children,
  onRequestClose,
  onClear,
  onApply,
  clearLabel = 'Limpar Filtros',
  applyLabel = 'Aplicar Filtros',
  testID,
}: FilterBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const [sheetHeight, setSheetHeight] = useState(windowHeight * 0.75);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      closingRef.current = false;
      translateY.setValue(windowHeight);
      return;
    }

    Keyboard.dismiss();
    closingRef.current = false;
    translateY.setValue(Math.max(sheetHeight, windowHeight * 0.55));
    const animation = Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 24,
      stiffness: 220,
      mass: 0.8,
    });
    animation.start();
    return () => animation.stop();
  }, [sheetHeight, translateY, visible, windowHeight]);

  const closeWithAnimation = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    Animated.timing(translateY, {
      toValue: Math.max(sheetHeight, windowHeight * 0.55),
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      closingRef.current = false;
      onRequestClose();
    });
  }, [onRequestClose, sheetHeight, translateY, windowHeight]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => (
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
      ),
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 88 || gesture.vy > 0.85) {
          closeWithAnimation();
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 240,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 240,
        }).start();
      },
    }),
    [closeWithAnimation, translateY]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeWithAnimation}
    >
      <View style={styles.modalRoot} testID={testID}>
        <Pressable
          style={styles.backdrop}
          onPress={closeWithAnimation}
          accessibilityRole="button"
          accessibilityLabel="Fechar filtros sem aplicar alterações"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: windowHeight * 0.88,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              transform: [{ translateY }],
            },
          ]}
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          accessibilityViewIsModal
        >
          <View
            style={styles.dragArea}
            {...panResponder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Arraste para baixo para fechar sem aplicar"
          >
            <View style={styles.handle} />
          </View>

          <View style={styles.sheetHeader}>
            <View style={styles.headerIcon}>
              <Ionicons name="options" size={24} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={closeWithAnimation}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Fechar sem aplicar alterações"
            >
              <Ionicons name="close-circle" size={32} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                Keyboard.dismiss();
                onClear();
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.primary} />
              <Text style={styles.clearButtonText}>{clearLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                Keyboard.dismiss();
                onApply();
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.applyGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.applyButtonText}>{applyLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 0,
    borderRadius: spacing.radiusLg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  triggerGradient: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: spacing.radiusLg,
  },
  triggerText: {
    color: colors.primary,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  triggerTextActive: {
    color: colors.white,
  },
  triggerBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.whiteTranslucent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerBadgeText: {
    color: colors.primaryDark,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
  },
  activeBar: {
    marginBottom: spacing.md,
  },
  activeBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  activeBarTitle: {
    color: colors.textLight,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  activeBarContent: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.screen,
  },
  activeChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  activeChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeChipText: {
    color: colors.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
  },
  removeChipButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.backgroundNeutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.errorBgLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  clearChipText: {
    color: colors.error,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    marginBottom: spacing.sm,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: spacing.xl,
    borderTopRightRadius: spacing.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  dragArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  handle: {
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
  },
  sheetSubtitle: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    marginTop: 2,
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: spacing.sm,
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetContent: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.card,
  },
  clearButton: {
    minHeight: 48,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  clearButtonText: {
    color: colors.primary,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  applyButton: {
    borderRadius: spacing.radius,
    overflow: 'hidden',
  },
  applyGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  applyButtonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
});
