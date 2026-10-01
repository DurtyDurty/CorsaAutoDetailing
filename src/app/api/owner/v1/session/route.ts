import { signInSchema, type SessionTokens } from "@shared/api";
import { signInForApi, signOutForApi } from "@/lib/auth/api-session";
import { handle, json, parseBody, rateLimit, withOwner } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sign in with the owner's email and password. 10 attempts per 10 minutes per client. */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "owner-api-sign-in", 10, 10 * 60_000);
  const { email, password } = await parseBody(req, signInSchema);
  return json<SessionTokens>(await signInForApi(email, password));
});

/** Sign out this device, or every device with `?scope=global`. */
export const DELETE = withOwner(async (req, { owner }) => {
  const scope = new URL(req.url).searchParams.get("scope") === "global" ? "global" : "local";
  await signOutForApi(owner, scope);
  return json({ ok: true, scope });
});