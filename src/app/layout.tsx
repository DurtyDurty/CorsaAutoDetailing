import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { business, absoluteUrl } from "@/config/business";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap", weight: ["400", "500"] });

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
  themeColor: "#0c0d10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
