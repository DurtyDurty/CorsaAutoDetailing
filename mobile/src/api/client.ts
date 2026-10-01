import type { ApiErrorBody, ApiErrorCode, SessionTokens } from "@shared/api";
import { API_BASE_PATH } from "@shared/api";
import { API_BASE_URL } from "@/config";
import { useSession } from "@/lib/session-store";

/** Error the UI can show as-is. `network` / `timeout` mean the request never got an answer. */
export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode | "network" | "timeout",
    message: string,
    readonly status: number | null,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const TIMEOUT_MS = 15_000;
/** Refresh a little before the token actually expires. */
const REFRESH_EARLY_SECONDS = 60;

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** false for sign-in and refresh. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function rawFetch(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  opts.signal?.addEventListener("abort", () => controller.abort());
  try {
    return await fetch(`${API_BASE_URL}${API_BASE_PATH}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted && !opts.signal?.aborted) {
      throw new ApiClientError("timeout", "The server took too long to answer. Check your signal and try again.", null);
    }
    throw new ApiClientError("network", "You're offline or the connection dropped. Try again when you have signal.", null);
  } finally {
    clearTimeout(timer);
  }
}

async function toError(res: Response): Promise<ApiClientError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  if (body?.error) return new ApiClientError(body.error.code, body.error.message, res.status, body.error.fields);
  return new ApiClientError("server_error", `The server returned an error (${res.status}). Try again.`, res.status);
}

let refreshing: Promise<SessionTokens | null> | null = null;

/** One refresh at a time, however many requests hit an expired token together. */
async function refreshSession(current: SessionTokens): Promise<SessionTokens | null> {
  refreshing ??= (async () => {
    try {
      const res = await rawFetch("/session/refresh", { method: "POST", body: { refreshToken: current.refreshToken }, auth: false }, null);
      if (!res.ok) {
        // Only a definite "no" signs you out; a network blip keeps the session for the next try.
        if (res.status === 401 || res.status === 403) await useSession.getState().signOutLocally();
        return null;
      }
      const next = (await res.json()) as SessionTokens;
      await useSession.getState().setSession(next);
      return next;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const needsAuth = opts.auth !== false;
  let session = needsAuth ? useSession.getState().session : null;
  if (needsAuth && !session) throw new ApiClientError("unauthorized", "Sign in to continue.", 401);

  if (session && session.expiresAt - REFRESH_EARLY_SECONDS < Date.now() / 1000) {
    session = (await refreshSession(session)) ?? session;
  }

  let res = await rawFetch(path, opts, session?.accessToken ?? null);
  if (res.status === 401 && session) {
    const next = await refreshSession(session);
    if (!next) throw new ApiClientError("unauthorized", "Your session has ended. Sign in again.", 401);
    res = await rawFetch(path, opts, next.accessToken);
  }
  if (!res.ok) {
    const err = await toError(res);
    if (err.code === "unauthorized" || err.code === "forbidden") await useSession.getState().signOutLocally();
    throw err;
  }
  return (await res.json()) as T;
}