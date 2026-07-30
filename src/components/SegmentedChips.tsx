import React from 'react';
import {
  Keyboard,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buttonStyles, colors, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type SegmentedChipOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: IconName;
  count?: number;
  disabled?: boolean;
};

type SegmentedChipsProps<T extends string = string> = {
  options: SegmentedChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function SegmentedChips<T extends string = string>({
  options,
  value,
  onChange,
  horizontal = false,
  style,
  contentStyle,
}: SegmentedChipsProps<T>) {
  const content = (
    <View style={[styles.content, contentStyle]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.chip,
              active ? styles.chipActive : null,
              option.disabled ? styles.disabled : null,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              onChange(option.value);
            }}
            disabled={option.disabled}
            activeOpacity={0.75}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={16}
                color={active ? colors.white : colors.primary}
              />
            ) : null}
            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
              {option.label}
            </Text>
            {typeof option.count === 'number' ? (
              <View style={[styles.count, active ? styles.countActive : null]}>
                <Text style={[styles.countText, active ? styles.countTextActive : null]}>
                  {option.count}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={style}
        contentContainerStyle={styles.scrollContent}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={style}>{content}</View>;
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scrollContent: {
    paddingRight: spacing.screen,
  },
  chip: {
    ...(buttonStyles.chip as ViewStyle),
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  chipActive: {
    ...(buttonStyles.chipActive as ViewStyle),
  },
  chipText: {
    ...(buttonStyles.chipText as TextStyle),
    color: colors.primary,
  },
  chipTextActive: {
    ...(buttonStyles.chipTextActive as TextStyle),
  },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.accent,
  },
  countActive: {
    backgroundColor: colors.whiteTranslucent,
  },
  countText: {
    color: colors.primary,
    fontSize: typography.fontSmall,
    fontWeight: typography.weightBold,
  },
  countTextActive: {
    color: colors.primaryDark,
  },
  disabled: {
    opacity: 0.5,
  },
});
