import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { storeKind } from "@/lib/leads/store";

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

export async function supabaseAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
    const email = data.user?.email?.toLowerCase();
    if (email && adminEmails().includes(email)) return { mode, email };
    return null;
  }
  if (mode === "demo") {
    const cookieStore = await cookies();
    const value = cookieStore.get(DEMO_COOKIE)?.value;
    if (!value) return null;
    const expected = demoToken();
    if (value.length !== expected.length) return null;
    if (timingSafeEqual(Buffer.from(value), Buffer.from(expected))) {
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

export async function signInWithPassword(email: string, password: string): Promise<{ error?: string }> {
  const mode = authMode();
  if (mode === "supabase") {
    if (!adminEmails().includes(email.toLowerCase())) {
      return { error: "That account is not authorized for this dashboard." };
    }
    const supabase = await supabaseAuthClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Sign-in failed. Check your email and password." };
    return {};
  }
  if (mode === "demo") {
    const expected = process.env.DEMO_ADMIN_PASSWORD!;
    const ok =
      password.length === expected.length && timingSafeEqual(Buffer.from(password), Buffer.from(expected));
    if (!ok) return { error: "Incorrect demo password." };
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
  return { error: "Admin sign-in is not configured." };
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
