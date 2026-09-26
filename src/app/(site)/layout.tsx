import { primaryCta } from "@/config/business";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PrelaunchBanner } from "@/components/site/PrelaunchBanner";
import { StickyCta } from "@/components/site/StickyCta";
import { AnalyticsScript } from "@/components/site/AnalyticsScript";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only-focusable fixed left-4 top-4 z-[100] bg-asphalt text-chalk px-4 py-2 rounded-sm"
      >
        Skip to content
      </a>
      <PrelaunchBanner />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <StickyCta {...primaryCta()} />
      <AnalyticsScript />
    </>
  );
}
