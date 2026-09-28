import { isPrelaunch } from "@/config/business";

export function ProcessSteps() {
  const steps = [
    {
      title: "Tell us about your vehicle",
      body: "Pick a service, describe the vehicle and its condition, and tell us roughly where and when. Two minutes on your phone.",
    },
    {
      title: "Get a confirmation and quote",
      body: "We review every request personally and reply with a firm quote. No hidden condition or travel charges. Anything extra is agreed before we start.",
    },
    {
      title: isPrelaunch ? "Enjoy mobile service after launch" : "We come to you",
      body: isPrelaunch
        ? "Once we open, we confirm a time that works, come to your driveway or workplace, and leave your car clean."
        : "We confirm a time that works, come to your driveway or workplace, and leave your car clean.",
    },
  ];
  return (
    <ol className="grid gap-px md:grid-cols-3 bg-line-dark border border-line-dark">
      {steps.map((s, i) => (
        <li key={s.title} className="group relative bg-asphalt p-7 sm:p-8 overflow-hidden">
          <span
            className="absolute left-0 top-0 h-[3px] w-12 bg-apex transition-all duration-500 group-hover:w-full"
            aria-hidden="true"
          />
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-apex" aria-hidden="true">
            Step 0{i + 1}
          </span>
          <span
            className="pointer-events-none absolute -right-2 -bottom-6 font-display italic font-extrabold text-[9rem] leading-none text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.09)]"
            aria-hidden="true"
          >
            0{i + 1}
          </span>
          <h3 className="relative font-display text-3xl mt-4">
            <span className="sr-only">Step {i + 1}: </span>
            {s.title}
          </h3>
          <p className="relative mt-3 text-chalk/70 leading-relaxed">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
