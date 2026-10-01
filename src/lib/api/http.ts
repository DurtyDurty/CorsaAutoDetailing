import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiErrorBody, ApiErrorCode } from "@shared/api";
import { ownerFromRequest, SessionError, type ApiOwner } from "@/lib/auth/api-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { fieldErrors } from "@/lib/validation";

/** Owner API responses carry customer data: never cache them anywhere. */
const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 422,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
  server_error: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function errorResponse(err: ApiError): NextResponse<ApiErrorBody> {
  const headers: Record<string, string> = { ...NO_STORE };
  if (err.retryAfterSeconds) headers["Retry-After"] = String(err.retryAfterSeconds);
  return NextResponse.json(
    { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } },
    { status: STATUS[err.code], headers },
  );
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof SessionError) return new ApiError(err.code, err.message);
  console.error("[owner-api]", err instanceof Error ? err.message : err);
  return new ApiError("server_error", "Something went wrong on our side. Try again.");
}

/** Wraps a handler so thrown ApiErrors (and anything unexpected) become JSON errors. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(toApiError(err));
    }
  };
}

type RouteCtx<P> = { params: Promise<P> };

/** Like `handle`, but requires a signed-in owner first. */
export function withOwner<P = Record<string, never>>(
  fn: (req: Request, ctx: { owner: ApiOwner; params: P }) => Promise<Response>,
) {
  return handle(async (req: Request, routeCtx?: RouteCtx<P>) => {
    const owner = await ownerFromRequest(req);
    const params = (routeCtx ? await routeCtx.params : {}) as P;
    return fn(req, { owner, params });
  });
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("invalid", "The request body must be JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError("invalid", "Some details need fixing.", fieldErrors(result.error));
  return result.data;
}

export function parseQuery<S extends z.ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) throw new ApiError("invalid", "Some filters are invalid.", fieldErrors(result.error));
  return result.data;
}

/** Hashed client IP from the request, so raw IPs are never kept. */
function clientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

export function rateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  const r = checkRateLimit(`${scope}:${clientId(req)}`, limit, windowMs);
  if (!r.ok) {
    throw new ApiError("rate_limited", "Too many attempts. Wait a moment and try again.", undefined, r.retryAfterSeconds);
  }
}
