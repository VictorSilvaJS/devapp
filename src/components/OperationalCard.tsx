import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cardStyles, colors, spacing, typography } from '../theme';
import { formatOperationalDateTime } from '../utils/operationalCardCompat';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type OperationalCardTag = {
  label: string;
  color: string;
  icon?: IoniconName;
  capitalize?: boolean;
};

export type OperationalCardMetadata = {
  label: string;
  icon: IoniconName;
};

export type OperationalCardChip = {
  label: string;
  color: string;
  icon: IoniconName;
};

type OperationalCardProps = {
  title: string;
  subtitle?: string;
  icon: IoniconName;
  accentColor: string;
  date?: unknown;
  tags?: OperationalCardTag[];
  metadata?: OperationalCardMetadata[];
  summary?: string;
  chips?: OperationalCardChip[];
  accessibilityLabel: string;
  onPress: () => void;
};

export default function OperationalCard({
  title,
  subtitle,
  icon,
  accentColor,
  date,
  tags = [],
  metadata = [],
  summary,
  chips = [],
  accessibilityLabel,
  onPress,
}: OperationalCardProps) {
  const metadataWithDate: OperationalCardMetadata[] = date
    ? [{ icon: 'calendar-outline', label: formatOperationalDateTime(date) }, ...metadata]
    : metadata;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${accentColor}18` }]}>
          <Ionicons name={icon} size={23} color={accentColor} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <Ionicons name="chevron-forward-outline" size={22} color={colors.muted} />
      </View>

      {tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.map((tag, index) => (
            <View
              key={`${tag.label}-${index}`}
              style={[styles.tag, { backgroundColor: `${tag.color}14`, borderColor: tag.color }]}
            >
              {tag.icon ? <Ionicons name={tag.icon} size={13} color={tag.color} /> : null}
              <Text
                style={[styles.tagText, { color: tag.color }, tag.capitalize ? styles.capitalize : null]}
                numberOfLines={1}
              >
                {tag.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {metadataWithDate.length > 0 ? (
        <View style={styles.metadataGrid}>
          {metadataWithDate.map((item, index) => (
            <View key={`${item.label}-${index}`} style={styles.metadataItem}>
              <Ionicons name={item.icon} size={16} color={colors.textLight} />
              <Text style={styles.metadataText} numberOfLines={1}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {summary ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText} numberOfLines={2}>{summary}</Text>
        </View>
      ) : null}

      {chips.length > 0 ? (
        <View style={styles.chipRow}>
          {chips.map((chip, index) => (
            <View
              key={`${chip.label}-${index}`}
              style={[styles.chip, { borderColor: chip.color, backgroundColor: `${chip.color}10` }]}
            >
              <Ionicons name={chip.icon} size={13} color={chip.color} />
              <Text style={[styles.chipText, { color: chip.color }]} numberOfLines={1}>
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardStyles.base,
    marginBottom: spacing.gap,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: spacing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
  },
  subtitle: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 180,
  },
  metadataText: {
    flex: 1,
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
  },
  summaryBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  summaryText: {
    color: colors.text,
    fontSize: typography.fontCaption + 1,
    lineHeight: 19,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipText: {
    flexShrink: 1,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
  },
});
