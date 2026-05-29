import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextStyle,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, searchBarStyles, spacing } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type SearchBarProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function SearchBar({
  value,
  onChangeText,
  onClear,
  icon = 'search-outline',
  placeholder = 'Buscar...',
  containerStyle,
  ...inputProps
}: SearchBarProps) {
  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    onChangeText('');
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={inputProps.placeholderTextColor || colors.muted}
        style={styles.input}
      />
      {value ? (
        <TouchableOpacity style={styles.clearButton} onPress={handleClear} activeOpacity={0.75}>
          <Ionicons name="close-circle" size={20} color={colors.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...(searchBarStyles.container as ViewStyle),
  },
  input: {
    ...(searchBarStyles.input as TextStyle),
  },
  clearButton: {
    padding: spacing.xs,
    marginRight: -spacing.xs,
  },
});
