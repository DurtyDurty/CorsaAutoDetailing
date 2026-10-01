import { forwardRef } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Text } from "./Text";
import { colors, fonts, MIN_TOUCH, radius, space } from "./theme";

interface Props extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

/** Labelled text input; the label is announced with the field. */
export const Field = forwardRef<TextInput, Props>(function Field({ label, error, hint, style, multiline, ...rest }, ref) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  multiline: { minHeight: 120, textAlignVertical: "top", paddingTop: space.md },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontFamily: fonts.bodyMedium, fontSize: 14 },
});