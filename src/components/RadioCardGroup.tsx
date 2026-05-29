import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type RadioCardOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
  disabled?: boolean;
};

type RadioCardGroupProps<T extends string = string> = {
  options: RadioCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
  style?: StyleProp<ViewStyle>;
};

export default function RadioCardGroup<T extends string = string>({
  options,
  value,
  onChange,
  error,
  style,
}: RadioCardGroupProps<T>) {
  return (
    <View style={[styles.group, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.card,
              active ? styles.cardActive : null,
              option.disabled ? styles.cardDisabled : null,
            ]}
            onPress={() => onChange(option.value)}
            disabled={option.disabled}
            activeOpacity={0.78}
          >
            <View style={[styles.radio, active ? styles.radioActive : null]}>
              {active ? <View style={styles.radioInner} /> : null}
            </View>

            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={20}
                color={active ? colors.primary : colors.muted}
                style={styles.icon}
              />
            ) : null}

            <View style={styles.textWrap}>
              <Text style={[styles.label, active ? styles.labelActive : null]}>{option.label}</Text>
              {option.description ? <Text style={styles.description}>{option.description}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  icon: {
    marginRight: spacing.sm,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: typography.weightBold,
  },
  description: {
    color: colors.muted,
    fontSize: typography.fontSmall,
    lineHeight: 16,
    marginTop: 2,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSmall,
  },
});
