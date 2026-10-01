import * as SecureStore from "expo-secure-store";
import type { SessionTokens } from "@shared/api";

/**
 * Session tokens in the iOS Keychain / Android Keystore. Each token is its
 * own entry (iOS can reject values over ~2 KB), readable only while the phone
 * is unlocked, and never synced to other devices or backups.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const KEYS = {
  access: "corsa.session.access",
  refresh: "corsa.session.refresh",
  meta: "corsa.session.meta",
} as const;

export async function saveSession(s: SessionTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.access, s.accessToken, OPTIONS),
    SecureStore.setItemAsync(KEYS.refresh, s.refreshToken, OPTIONS),
    SecureStore.setItemAsync(KEYS.meta, JSON.stringify({ expiresAt: s.expiresAt, email: s.email, role: s.role }), OPTIONS),
  ]);
}

export async function loadSession(): Promise<SessionTokens | null> {
  const [accessToken, refreshToken, meta] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access, OPTIONS),
    SecureStore.getItemAsync(KEYS.refresh, OPTIONS),
    SecureStore.getItemAsync(KEYS.meta, OPTIONS),
  ]);
  if (!accessToken || !refreshToken || !meta) return null;
  try {
    const m = JSON.parse(meta) as Pick<SessionTokens, "expiresAt" | "email" | "role">;
    return { accessToken, refreshToken, ...m };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k, OPTIONS)));
}