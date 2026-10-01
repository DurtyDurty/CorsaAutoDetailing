import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@shared/appointment-status";
import { cn } from "@/lib/utils";

/** Same shapes and words as the app: the glyph and label carry meaning, color reinforces it. */
const TONE: Record<AppointmentStatus, { cls: string; glyph: string }> = {
  held: { cls: "border-[#b7791f] text-[#8a5a12]", glyph: "◷" },
  confirmed: { cls: "border-ink text-ink", glyph: "●" },
  en_route: { cls: "border-apex-deep text-apex-deep", glyph: "➤" },
  arrived: { cls: "border-apex-deep text-apex-deep", glyph: "◉" },
  in_progress: { cls: "border-apex-deep text-apex-deep", glyph: "▶" },
  completed: { cls: "border-success text-success", glyph: "✓" },
  cancelled: { cls: "border-line text-ink-muted", glyph: "✕" },
  no_show: { cls: "border-error text-error", glyph: "!" },
  declined: { cls: "border-line text-ink-muted", glyph: "✕" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const t = TONE[status];
  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-sm border px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.12em]", t.cls)}>
      <span aria-hidden="true">{t.glyph}</span>
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  );
}