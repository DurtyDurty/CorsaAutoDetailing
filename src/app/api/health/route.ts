import { NextResponse } from "next/server";
import { business } from "@/config/business";
import { getLeadStore, storeKind } from "@/lib/leads/store";
import { emailKind } from "@/lib/email";
import { authMode, ownerOrNull } from "@/lib/auth/owner";
import { photosEnabled } from "@/lib/photos";

export const dynamic = "force-dynamic";

/**
 * Health + launch-readiness check.
 * Public response is minimal. Full detail requires an owner session or a
 * non-production environment, so configuration is never leaked publicly.
 */
export async function GET() {
  const store = await getLeadStore();
  const health = store ? await store.health().catch((e: Error) => ({ ok: false, kind: store.kind, detail: e.message })) : null;
  const owner = await ownerOrNull();
  const detailed = process.env.NODE_ENV !== "production" || Boolean(owner);

  const checks = {
    leadStore: { kind: storeKind(), ok: Boolean(health?.ok) },
    email: { kind: emailKind(), ok: emailKind() === "resend" },
    ownerNotifyEmail: Boolean(process.env.OWNER_NOTIFY_EMAIL),
    adminAuth: { mode: authMode(), ok: authMode() === "supabase" },
    photos: photosEnabled(),
    siteUrl: business.brand.canonicalDomain,
    siteEnv: business.brand.siteEnv,
    businessMode: business.mode,
    launchDate: business.launchDate,
    contactEmailConfigured: Boolean(business.contact.email),
  };

  const readyForLaunch =
    checks.leadStore.kind === "supabase" &&
    checks.leadStore.ok &&
    checks.email.ok &&
    checks.ownerNotifyEmail &&
    checks.adminAuth.ok &&
    checks.siteUrl.startsWith("https://") &&
    checks.contactEmailConfigured;

  if (!detailed) {
    return NextResponse.json(
      { ok: Boolean(health?.ok), mode: business.mode },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: Boolean(health?.ok), readyForLaunch, checks, storeDetail: health?.detail ?? "No lead store available." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
