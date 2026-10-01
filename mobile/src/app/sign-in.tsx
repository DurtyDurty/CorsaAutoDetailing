import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInSchema, type SignInInput } from "@shared/api";
import { ApiClientError } from "@/api/client";
import { signIn } from "@/api/queries";
import { Button } from "@/design/Button";
import { Text } from "@/design/Text";
import { colors, fonts, MIN_TOUCH, radius, space } from "@/design/theme";
import { useSession } from "@/lib/session-store";

export default function SignInScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const password = useRef<TextInput>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await useSession.getState().setSession(await signIn(values));
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Sign-in failed. Try again.");
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image
            source={require("../../assets/logo-light.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Corsa Auto Detailing"
          />
          <View style={styles.headline}>
            <Text variant="label">Owner</Text>
            <Text variant="display">Sign in</Text>
            <Text variant="caption">Use the email and password you use for the web dashboard.</Text>
          </View>

          <View style={styles.field}>
            <Text variant="label" nativeID="email-label">
              Email
            </Text>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <TextInput
                  accessibilityLabelledBy="email-label"
                  style={[styles.input, errors.email && styles.inputError]}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => password.current?.focus()}
                  placeholderTextColor={colors.textMuted}
                />
              )}
            />
            {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
          </View>

          <View style={styles.field}>
            <Text variant="label" nativeID="password-label">
              Password
            </Text>
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextInput
                  ref={password}
                  accessibilityLabelledBy="password-label"
                  style={[styles.input, errors.password && styles.inputError]}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => void onSubmit()}
                />
              )}
            />
            {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
          </View>

          {formError && (
            <Text style={styles.error} accessibilityRole="alert">
              {formError}
            </Text>
          )}
          <Button label="Sign in" haptic="medium" loading={isSubmitting} onPress={() => void onSubmit()} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.xl, flexGrow: 1, justifyContent: "center" },
  logo: { width: "72%", height: undefined, aspectRatio: 1612 / 326, alignSelf: "flex-start" },
  headline: { gap: space.sm },
  field: { gap: space.sm },
  input: {
    minHeight: MIN_TOUCH + 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 17,
  },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontFamily: fonts.bodyMedium, fontSize: 14 },
});