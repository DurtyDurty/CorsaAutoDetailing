import type { MeResponse } from "@shared/api";
import { business } from "@/config/business";
import { json, withOwner } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withOwner(async (_req, { owner }) =>
  json<MeResponse>({
    email: owner.email,
    role: owner.role,
    business: { name: business.brand.name, timeZone: business.timeZone },
  }),
);