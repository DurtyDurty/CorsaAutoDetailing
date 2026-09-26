import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { business, absoluteUrl } from "@/config/business";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

const noindex = business.brand.siteEnv === "staging";

export const metadata: Metadata = {
  metadataBase: new URL(business.brand.canonicalDomain),
  title: {
    default: `${business.brand.name} — Mobile detailing in Clay County, FL`,
    template: `%s — ${business.brand.name}`,
  },
  description:
    "Mobile exterior washing and interior maintenance for daily drivers in Middleburg, Fleming Island, Green Cove Springs, and Orange Park. Preparing to launch.",
  applicationName: business.brand.name,
  openGraph: {
    type: "website",
    siteName: business.brand.name,
    locale: "en_US",
    url: absoluteUrl("/"),
  },
  robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#202326",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
