import { APPOINTMENT_STATUSES } from "@shared/appointment-status";
import { checkTransition } from "@shared/appointment-status";
import { nextStep } from "../next-step";

describe("nextStep", () => {
  it("walks a job from booked to done", () => {
    expect(nextStep("confirmed")?.to).toBe("en_route");
    expect(nextStep("en_route")?.to).toBe("arrived");
    expect(nextStep("arrived")?.to).toBe("in_progress");
    expect(nextStep("in_progress")?.to).toBe("completed");
  });

  it("asks before completing a job", () => {
    expect(nextStep("in_progress")?.confirm).toBeDefined();
    expect(nextStep("confirmed")?.confirm).toBeUndefined();
  });

  it("only ever suggests a step the server allows", () => {
    for (const s of APPOINTMENT_STATUSES) {
      const step = nextStep(s);
      if (step) expect(checkTransition(s, step.to)).toEqual({ ok: true, noop: false });
    }
  });

  it("offers nothing for finished jobs", () => {
    for (const s of ["completed", "cancelled", "no_show", "declined"] as const) expect(nextStep(s)).toBeNull();
  });
});