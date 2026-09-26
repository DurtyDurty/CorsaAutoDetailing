import { isPrelaunch } from "@/config/business";

export function ProcessSteps() {
  const steps = [
    {
      title: "Tell us about your vehicle",
      body: "Pick a service, describe the vehicle and its condition, and tell us roughly where and when. Two minutes on your phone.",
    },
    {
      title: "Get a confirmation and quote",
      body: "We review every request personally and reply with a firm quote. No hidden condition or travel charges — anything extra is agreed before we start.",
    },
    {
      title: isPrelaunch ? "Enjoy mobile service after launch" : "We come to you",
      body: isPrelaunch
        ? "Once we open, we confirm a time that works, come to your driveway or workplace, and leave your car clean."
        : "We confirm a time that works, come to your driveway or workplace, and leave your car clean.",
    },
  ];
  return (
    <ol className="grid gap-8 md:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="relative border-t border-charcoal pt-5">
          <span className="font-display text-champagne-deep text-lg" aria-hidden="true">
            0{i + 1}
          </span>
          <h3 className="font-medium text-lg mt-2">
            <span className="sr-only">Step {i + 1}: </span>
            {s.title}
          </h3>
          <p className="mt-2 text-ink-muted leading-relaxed">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
