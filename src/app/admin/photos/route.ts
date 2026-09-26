import { NextResponse, type NextRequest } from "next/server";
import { ownerOrNull } from "@/lib/auth/owner";
import { signedPhotoUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Redirects an authorized owner to a short-lived signed URL for a private photo. */
export async function GET(req: NextRequest) {
  if (!(await ownerOrNull())) return new NextResponse("Unauthorized", { status: 401 });
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  if (!/^leads\/[0-9a-f-]{36}\/\d+\.jpg$/.test(ref)) return new NextResponse("Bad request", { status: 400 });
  const url = await signedPhotoUrl(ref, 300);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
}
