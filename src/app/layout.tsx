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
    default: `${business.brand.name} | Mobile auto detailing in Clay County & Jacksonville, FL`,
    template: `%s | ${business.brand.name}`,
  },
  description:
    "Mobile auto detailing in Clay County and Jacksonville, FL. Interior and exterior car detailing at your home or workplace. Driven by Detail.",
  applicationName: business.brand.name,
  openGraph: {
    type: "website",
    siteName: business.brand.name,
    locale: "en_US",
    url: absoluteUrl("/"),
  },
  twitter: { card: "summary_large_image" },
  // Bing Webmaster Tools ownership (Google is verified by DNS TXT instead).
  verification: { other: { "msvalidate.01": "89118DC60485CDDF4C3A26B36FE18B9B" } },
  robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon.png",
  },
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
