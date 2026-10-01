import { refreshSchema, type SessionTokens } from "@shared/api";
import { refreshForApi } from "@/lib/auth/api-session";
import { handle, json, parseBody, rateLimit } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Exchange a refresh token for a new session. */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "owner-api-refresh", 30, 10 * 60_000);
  const { refreshToken } = await parseBody(req, refreshSchema);
  return json<SessionTokens>(await refreshForApi(refreshToken));
});