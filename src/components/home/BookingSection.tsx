import { isPrelaunch } from "@/config/business";
import { dict, type Lang } from "@/i18n/dictionary";
import { photosEnabled } from "@/lib/photos";
import { Section, SectionHeading } from "@/components/ui/Section";
import { BookingWizard } from "@/components/forms/BookingWizard";
import { LaunchListForm } from "@/components/forms/LaunchListForm";
import { BOOKING_FORM_ID } from "@/components/site/MobileActionBar";

/** The booking form section (home and /book): the 3-step request, or the launch list before launch. */
export function BookingSection({
  lang,
  num,
  initialService,
  firstTimeOffer,
  heading = true,
}: {
  lang: Lang;
  num?: number;
  initialService?: string;
  firstTimeOffer?: boolean;
  /** /book has its own page title above the form. */
  heading?: boolean;
}) {
  const d = dict(lang).book;
  return (
    <Section tone="night" id={BOOKING_FORM_ID} labelledBy={heading ? "book-title" : undefined} className={heading ? undefined : "pt-6 sm:pt-10"}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:items-start">
        {heading ? <SectionHeading id="book-title" num={num} title={d.title} lede={d.lede} onDark /> : <div className="hidden lg:block" />}
        {/* min-w-0: a grid column otherwise grows to fit the scrolling day strip and widens the page. */}
        <div className="w-full min-w-0 max-w-2xl">
          {/* No "unavailable" check here: the home page is built ahead of time. If the database is ever missing,
              sending the form says so and gives the phone number (intake / holdRequest). */}
          {isPrelaunch ? (
            <div id="launch-list" className="rounded-lg bg-chalk p-6 text-ink">
              <LaunchListForm initialService={initialService} />
            </div>
          ) : (
            <BookingWizard lang={lang} initialService={initialService} firstTimeOffer={firstTimeOffer} photosEnabled={photosEnabled()} />
          )}
        </div>
      </div>
    </Section>
  );
}
