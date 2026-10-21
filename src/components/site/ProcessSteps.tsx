import { isPrelaunch } from "@/config/business";

export function ProcessSteps() {
  const steps = [
    {
      title: isPrelaunch ? "Tell us about your vehicle" : "Pick a service and a time",
      body: isPrelaunch
        ? "Pick a service, describe the vehicle and its condition, and tell us roughly where and when. Two minutes on your phone."
        : "Choose a package, tell us about the vehicle, and pick an open time on the calendar. Two minutes on your phone.",
    },
    {
      title: isPrelaunch ? "Get a confirmation and quote" : "Get your confirmation",
      body: isPrelaunch
        ? "We review every request personally and reply with a firm quote. No hidden condition or travel charges. Anything extra is agreed before we start."
        : "We hold your time while we review your request, then confirm it by email. No hidden condition or travel charges. Anything extra is agreed before we start.",
    },
    {
      title: isPrelaunch ? "Enjoy mobile service after launch" : "We come to you",
      body: isPrelaunch
        ? "Once we open, we confirm a time that works, come to your driveway or workplace, and leave your car clean."
        : "We come to your driveway or workplace at your time and leave your car clean. You pay when the job is done.",
    },
  ];
  return (
    <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
      {steps.map((s, i) => (
        <li key={s.title}>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-apex-deep text-base font-semibold text-white"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <h3 className="mt-5 text-xl font-semibold">
            <span className="sr-only">Step {i + 1}: </span>
            {s.title}
          </h3>
          <p className="mt-2 text-ink-muted leading-relaxed">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
