import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    // Script-src stays permissive for Next's inline runtime; tighten with nonces before
    // enabling any third-party embeds. See docs/SETUP.md.
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // Google Ads tag (gtag.js) and its conversion pings, per Google's CSP guide for the Ads tag.
      "script-src 'self' 'unsafe-inline' https://plausible.io https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
      "connect-src 'self' https://plausible.io https://*.supabase.co https://www.googletagmanager.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://td.doubleclick.net https://ad.doubleclick.net",
      "frame-src https://www.googletagmanager.com https://bid.g.doubleclick.net https://td.doubleclick.net",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // The LIVE-mode e2e suite builds into a separate folder so it doesn't clobber the main build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    // Photo uploads: the booking form shrinks photos in the browser to fit Vercel's 4.5MB request cap.
    // Without uploads the forms are a few KB of text.
    serverActions: { bodySizeLimit: process.env.SUPABASE_STORAGE_BUCKET ? "5mb" : "1mb" },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/thanks/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      // Customer quotes and invoices are reached only by private links.
      {
        source: "/:prefix(quote|q|invoice)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
