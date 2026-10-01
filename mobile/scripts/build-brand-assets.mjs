// Renders the app's icon, splash mark and logo from the website's brand SVGs
// (public/), so the app always uses the real Corsa artwork.
// Run from mobile/: node scripts/build-brand-assets.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
// sharp is a dependency of the website, not the app.
const sharp = createRequire(path.join(root, "package.json"))("sharp");

const asphalt = "#0c0d10";
const out = (name) => path.join(here, "..", "assets", name);
const src = (name) => path.join(root, "public", name);

// iOS needs a square, fully opaque icon; it applies its own rounded mask.
await sharp(src("icon.svg"), { density: 1024 })
  .resize(1024, 1024)
  .flatten({ background: asphalt })
  .png()
  .toFile(out("icon.png"));

// Splash and Android adaptive-icon foreground: the mark alone, transparent.
await sharp(src("icon.svg"), { density: 1024 }).resize(1024, 1024).png().toFile(out("splash-icon.png"));

// Horizontal logo for dark backgrounds (sign-in screen, headers).
await sharp(src("brand/logo-light.svg"), { density: 300 }).resize({ width: 1612 }).png().toFile(out("logo-light.png"));

console.log("Brand assets written to mobile/assets/");
