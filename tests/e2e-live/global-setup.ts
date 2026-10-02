import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * The local demo store (.data, git-ignored test data) keeps requests from
 * earlier runs, and each can hold a time for up to 48 hours. The site only lets
 * a few unconfirmed requests hold a time at once, so leftovers would make a
 * fresh run's request go through without a hold. Release them first.
 */
export default async function releaseLeftoverHolds() {
  const file = path.join(process.cwd(), ".data", "demo-store.json");
  let data: { appointments?: { status: string; depositStatus: string; updatedAt: string }[] };
  try {
    data = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return; // No demo store yet.
  }
  const held = (data.appointments ?? []).filter((a) => a.status === "held");
  if (held.length === 0) return;
  for (const a of held) Object.assign(a, { status: "cancelled", depositStatus: "released", updatedAt: new Date().toISOString() });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}
