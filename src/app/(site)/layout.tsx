import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PrelaunchBanner } from "@/components/site/PrelaunchBanner";
import { MobileActionBar } from "@/components/site/MobileActionBar";
import { WelcomeOffer } from "@/components/site/WelcomeOffer";
import { AnalyticsScript } from "@/components/site/AnalyticsScript";
import { AttributionCapture } from "@/components/site/AttributionCapture";
import { GoogleAdsTag } from "@/components/site/GoogleAdsTag";

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
      <MobileActionBar />
      <WelcomeOffer />
      <AnalyticsScript />
      <AttributionCapture />
      <GoogleAdsTag />
    </>
  );
}
