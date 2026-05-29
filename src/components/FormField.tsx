import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, inputStyles, spacing, typography } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type FormFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  textarea?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export default function FormField({
  label,
  error,
  helperText,
  required = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  textarea = false,
  disabled = false,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  editable = true,
  multiline,
  ...inputProps
}: FormFieldProps) {
  const isMultiline = textarea || multiline;
  const isEditable = !disabled && editable !== false;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          error ? styles.inputError : null,
          disabled ? styles.inputDisabled : null,
          inputContainerStyle,
        ]}
      >
        {leftIcon ? (
          <Ionicons name={leftIcon} size={20} color={colors.muted} style={styles.leftIcon} />
        ) : null}

        <TextInput
          {...inputProps}
          editable={isEditable}
          multiline={isMultiline}
          placeholderTextColor={inputProps.placeholderTextColor || colors.muted}
          textAlignVertical={isMultiline ? 'top' : 'center'}
          style={[styles.input, isMultiline ? styles.textarea : null, inputStyle]}
        />

        {rightIcon ? (
          <TouchableOpacity
            style={styles.rightIconButton}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            activeOpacity={0.75}
          >
            <Ionicons name={rightIcon} size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...inputStyles.container,
  },
  label: {
    ...inputStyles.label,
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputDisabled: {
    backgroundColor: colors.backgroundAlt,
    opacity: 0.72,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontBody,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  textarea: {
    minHeight: 96,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIconButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  errorText: {
    ...inputStyles.errorText,
  },
  helperText: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: typography.fontSmall,
    lineHeight: 16,
  },
});
