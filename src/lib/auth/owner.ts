import "server-only";
import { createHash, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { storeKind } from "@/lib/leads/store";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/safe-equal";

/**
 * Owner authentication for /admin.
 *
 * - Supabase mode: Supabase Auth session (email + password, no public signup).
 *   The signed-in user's email must be listed in ADMIN_EMAILS.
 * - Demo mode (non-production only): a single DEMO_ADMIN_PASSWORD guards an
 *   HMAC-signed cookie. Never active in production.
 * - Otherwise: admin is unavailable.
 *
 * Every admin page, server action and route handler calls `requireOwner()`.
 */

export type AuthMode = "supabase" | "demo" | "unavailable";

export interface OwnerSession {
  mode: AuthMode;
  email: string;
}

const DEMO_COOKIE = "corsa_demo_admin";

export function authMode(): AuthMode {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.ADMIN_EMAILS
  ) {
    return "supabase";
  }
  // Demo auth is only possible when the demo store is active, which itself
  // requires a non-production build or the explicit ALLOW_DEMO_STORE override.
  if (storeKind() === "demo" && process.env.DEMO_ADMIN_PASSWORD) {
    return "demo";
  }
  return "unavailable";
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Optional second lock (ADMIN_USER_IDS, comma-separated Supabase user ids). When
 * set, an account must match on id as well as email, so a new account that
 * somehow carries an allowed email still gets nothing.
 */
export function adminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

/** The owner check for a Supabase-verified user. Returns the allowed email, or null. */
export function ownerEmailOf(user: { id?: string; email?: string | null } | null | undefined): string | null {
  const email = user?.email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) return null;
  const ids = adminUserIds();
  if (ids.length && !(user?.id && ids.includes(user.id.toLowerCase()))) return null;
  return email;
}

export async function supabaseAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    // The session cookie holds the access and refresh tokens. Nothing in the browser reads it,
    // so keep it away from page scripts and off plain HTTP.
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component render: cookies are read-only there.
        }
      },
    },
  });
}

function demoToken(): string {
  return createHmac("sha256", process.env.DEMO_ADMIN_PASSWORD!).update("demo-admin-session").digest("hex");
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const mode = authMode();
  if (mode === "supabase") {
    const supabase = await supabaseAuthClient();
    const { data } = await supabase.auth.getUser();
    const email = ownerEmailOf(data.user);
    return email ? { mode, email } : null;
  }
  if (mode === "demo") {
    const cookieStore = await cookies();
    const value = cookieStore.get(DEMO_COOKIE)?.value;
    if (!value) return null;
    if (safeEqual(value, demoToken())) {
      return { mode, email: "demo-owner@localhost" };
    }
  }
  return null;
}

/** Redirects to the login page when there is no owner session. */
export async function requireOwner(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** For route handlers: returns null instead of redirecting. */
export async function ownerOrNull(): Promise<OwnerSession | null> {
  return getOwnerSession();
}

export type SignInError = "failed" | "unavailable";

export async function signInWithPassword(email: string, password: string): Promise<{ error?: SignInError }> {
  const mode = authMode();
  if (mode === "supabase") {
    // Same answer as a wrong password, so the form can't be used to find the owner's email.
    if (!adminEmails().includes(email.toLowerCase())) return { error: "failed" };
    const supabase = await supabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "failed" };
    if (!ownerEmailOf(data.user)) {
      // Right password, but not an owner account: don't leave its session cookie behind.
      await supabase.auth.signOut({ scope: "local" });
      return { error: "failed" };
    }
    return {};
  }
  if (mode === "demo") {
    if (!safeEqual(password, process.env.DEMO_ADMIN_PASSWORD!)) return { error: "failed" };
    const cookieStore = await cookies();
    cookieStore.set(DEMO_COOKIE, demoToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: 60 * 60 * 8,
    });
    return {};
  }
  return { error: "unavailable" };
}

const SIGN_IN_WINDOW_MS = 10 * 60_000;

/**
 * Sign-in for the dashboard form: at most 10 tries per client and 20 per account
 * in 10 minutes, counted before the password is checked. The counters live in
 * this server instance's memory, so they slow guessing down; a long unique
 * password (and MFA on the Supabase account) is what stops it.
 */
export async function signInThrottled(email: string, password: string): Promise<{ error?: SignInError | "rate_limited" }> {
  const account = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24);
  const byClient = checkRateLimit(await clientKey("admin-login"), 10, SIGN_IN_WINDOW_MS);
  const byAccount = checkRateLimit(`admin-login-account:${account}`, 20, SIGN_IN_WINDOW_MS);
  if (!byClient.ok || !byAccount.ok) return { error: "rate_limited" };
  return signInWithPassword(email, password);
}

export async function signOut(): Promise<void> {
  const mode = authMode();
  if (mode === "supabase") {
    const supabase = await supabaseAuthClient();
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  // Must match the path the cookie was set with, or the browser keeps the original.
  cookieStore.delete({ name: DEMO_COOKIE, path: "/admin" });
}
