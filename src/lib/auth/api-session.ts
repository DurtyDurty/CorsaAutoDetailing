import "server-only";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Role, SessionTokens } from "@shared/api";
import { safeEqual } from "@/lib/safe-equal";
import { adminEmails, authMode, ownerEmailOf, type AuthMode } from "./owner";

/**
 * Bearer-token sessions for the owner app (`/api/owner/v1`).
 *
 * - Supabase mode: the server signs in with Supabase Auth on the app's behalf
 *   and hands back Supabase's access + refresh tokens, but only for emails in
 *   ADMIN_EMAILS (checked before and after sign-in). Every request re-verifies
 *   the access token with Supabase, so revoked or expired tokens fail at once.
 * - Demo mode (local dev and e2e only): HMAC-signed, expiring tokens keyed by
 *   DEMO_ADMIN_PASSWORD.
 *
 * The app never receives the service-role key, and needs no Supabase keys at all.
 */

export interface ApiOwner {
  mode: Exclude<AuthMode, "unavailable">;
  email: string;
  role: Role;
  /** The bearer token the request carried (for sign-out). */
  token: string;
}

export class SessionError extends Error {
  constructor(
    readonly code: "unauthorized" | "forbidden" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

const GENERIC_SIGN_IN_ERROR = "Sign-in failed. Check your email and password.";

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Everyone authorized today is the owner; a staff table will assign other roles. */
function roleFor(): Role {
  return "owner";
}

/* ---------- Demo tokens ---------- */

const DEMO_ACCESS_SECONDS = 60 * 60 * 8;
const DEMO_REFRESH_SECONDS = 60 * 60 * 24 * 30;
const DEMO_EMAIL = "demo-owner@localhost";

function demoSign(kind: "access" | "refresh", exp: number): string {
  const mac = createHmac("sha256", process.env.DEMO_ADMIN_PASSWORD!).update(`${kind}:${exp}`).digest("hex");
  return `demo-${kind}.${exp}.${mac}`;
}

function demoVerify(kind: "access" | "refresh", token: string): boolean {
  const [prefix, expRaw, mac] = token.split(".");
  if (prefix !== `demo-${kind}` || !expRaw || !mac) return false;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  return safeEqual(token, demoSign(kind, exp));
}

function demoTokens(): SessionTokens {
  const now = Math.floor(Date.now() / 1000);
  return {
    accessToken: demoSign("access", now + DEMO_ACCESS_SECONDS),
    refreshToken: demoSign("refresh", now + DEMO_REFRESH_SECONDS),
    expiresAt: now + DEMO_ACCESS_SECONDS,
    email: DEMO_EMAIL,
    role: roleFor(),
  };
}

/* ---------- Public API ---------- */

export async function signInForApi(email: string, password: string): Promise<SessionTokens> {
  const mode = authMode();
  if (mode === "supabase") {
    // Same message for unknown accounts and wrong passwords, so the endpoint can't be used to find owner emails.
    if (!adminEmails().includes(email)) throw new SessionError("unauthorized", GENERIC_SIGN_IN_ERROR);
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    const session = data.session;
    const signedIn = ownerEmailOf(session?.user);
    if (error || !session || !signedIn) {
      throw new SessionError("unauthorized", GENERIC_SIGN_IN_ERROR);
    }
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
      email: signedIn,
      role: roleFor(),
    };
  }
  if (mode === "demo") {
    if (!safeEqual(password, process.env.DEMO_ADMIN_PASSWORD!)) throw new SessionError("unauthorized", GENERIC_SIGN_IN_ERROR);
    return demoTokens();
  }
  throw new SessionError("unavailable", "Owner sign-in is not configured on the server.");
}

export async function refreshForApi(refreshToken: string): Promise<SessionTokens> {
  const mode = authMode();
  if (mode === "supabase") {
    const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    const session = data.session;
    if (error || !session?.user.email) throw new SessionError("unauthorized", "Your session has ended. Sign in again.");
    // Removed from the allow-list since the last sign-in: stop here.
    const email = ownerEmailOf(session.user);
    if (!email) throw new SessionError("forbidden", "This account no longer has access.");
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
      email,
      role: roleFor(),
    };
  }
  if (mode === "demo") {
    if (!demoVerify("refresh", refreshToken)) throw new SessionError("unauthorized", "Your session has ended. Sign in again.");
    return demoTokens();
  }
  throw new SessionError("unavailable", "Owner sign-in is not configured on the server.");
}

/** Resolves the owner from an `Authorization: Bearer …` header, or throws. */
export async function ownerFromRequest(req: Request): Promise<ApiOwner> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token || token.length > 4000) throw new SessionError("unauthorized", "Sign in to continue.");

  const mode = authMode();
  if (mode === "supabase") {
    const { data, error } = await anonClient().auth.getUser(token);
    if (error || !data.user?.email) throw new SessionError("unauthorized", "Your session has ended. Sign in again.");
    const email = ownerEmailOf(data.user);
    if (!email) throw new SessionError("forbidden", "This account doesn't have access.");
    return { mode, email, role: roleFor(), token };
  }
  if (mode === "demo") {
    if (!demoVerify("access", token)) throw new SessionError("unauthorized", "Your session has ended. Sign in again.");
    return { mode, email: DEMO_EMAIL, role: roleFor(), token };
  }
  throw new SessionError("unavailable", "Owner sign-in is not configured on the server.");
}

/**
 * Ends the session. `global` signs out every device (Supabase revokes all
 * refresh tokens for the user). Demo tokens simply expire.
 */
export async function signOutForApi(owner: ApiOwner, scope: "local" | "global"): Promise<void> {
  if (owner.mode !== "supabase") return;
  const admin = serviceClient();
  if (!admin) throw new SessionError("unavailable", "Sign-out isn't configured on the server.");
  const { error } = await admin.auth.admin.signOut(owner.token, scope);
  if (error) throw new Error(`Sign-out failed: ${error.message}`);
}
