import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed/700Bold";
import { BarlowCondensed_800ExtraBold_Italic } from "@expo-google-fonts/barlow-condensed/800ExtraBold_Italic";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { queryClient, wireQueryLifecycle } from "@/api/queries";
import { colors, fonts } from "@/design/theme";
import { clearAllDrafts } from "@/lib/drafts";
import { useSession } from "@/lib/session-store";

/** Screens pushed over the tabs get a native header with a back button. */
const pushed = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontFamily: fonts.bodySemiBold },
  headerBackButtonDisplayMode: "minimal" as const,
};

void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(colors.background);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
  });
  const status = useSession((s) => s.status);

  useEffect(() => {
    void useSession.getState().restore();
    return wireQueryLifecycle();
  }, []);

  // Signing out (or a revoked session) wipes every cached customer record.
  useEffect(() => {
    if (status === "signedOut") {
      queryClient.clear();
      clearAllDrafts();
    }
  }, [status]);

  const ready = fontsLoaded && status !== "loading";
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const signedIn = status === "signedIn";
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="conversation/[leadId]" options={{ ...pushed, title: "Conversation" }} />
            <Stack.Screen name="appointment/new" options={{ ...pushed, title: "New appointment", presentation: "modal" }} />
            <Stack.Screen name="appointment/[id]" options={{ ...pushed, title: "Job" }} />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}