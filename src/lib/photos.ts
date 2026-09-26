import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Optional customer vehicle photos.
 *
 * Enabled only when Supabase storage is configured (SUPABASE_STORAGE_BUCKET).
 * Files are validated by actual content (magic bytes + decode with sharp),
 * re-encoded to JPEG (which strips EXIF/GPS metadata), and stored in a PRIVATE
 * bucket. The admin dashboard reads them through short-lived signed URLs.
 */

export const PHOTO_MAX_COUNT = 5;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export function photosEnabled(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET,
  );
}

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export interface PhotoResult {
  refs: string[];
  rejected: string[];
}

function storage() {
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(process.env.SUPABASE_STORAGE_BUCKET!);
}

/**
 * Validate, sanitise and store up to PHOTO_MAX_COUNT images for a lead.
 * Returns storage object paths. Never throws for a bad file — it is listed in `rejected`.
 */
export async function storeLeadPhotos(leadId: string, files: File[]): Promise<PhotoResult> {
  const result: PhotoResult = { refs: [], rejected: [] };
  if (!photosEnabled()) return result;
  const sharp = (await import("sharp")).default;
  const bucket = storage();

  for (const [i, file] of files.slice(0, PHOTO_MAX_COUNT).entries()) {
    const label = file.name || `photo-${i + 1}`;
    if (file.size === 0) continue;
    if (file.size > PHOTO_MAX_BYTES) {
      result.rejected.push(`${label}: larger than 10MB`);
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!sniff(buf)) {
      result.rejected.push(`${label}: not a JPEG, PNG or WebP image`);
      continue;
    }
    let jpeg: Buffer;
    try {
      // Decoding proves it is a real raster image; re-encoding drops all metadata.
      jpeg = await sharp(buf, { failOn: "error", limitInputPixels: 50_000_000 })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch {
      result.rejected.push(`${label}: could not be read as an image`);
      continue;
    }
    const objectPath = `leads/${leadId}/${i + 1}.jpg`;
    const { error } = await bucket.upload(objectPath, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) {
      result.rejected.push(`${label}: upload failed`);
      continue;
    }
    result.refs.push(objectPath);
  }
  return result;
}

/** Short-lived signed URL for admin viewing. Caller must already be authorized. */
export async function signedPhotoUrl(ref: string, expiresSeconds = 300): Promise<string | null> {
  if (!photosEnabled()) return null;
  const { data, error } = await storage().createSignedUrl(ref, expiresSeconds);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteLeadPhotos(refs: string[]): Promise<void> {
  if (!photosEnabled() || refs.length === 0) return;
  await storage().remove(refs);
}
