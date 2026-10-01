/** The ok / error message a dashboard action redirects back with. */
export function Flash({ ok, error }: { ok?: string | string[]; error?: string | string[] }) {
  if (typeof error === "string") {
    return (
      <p role="alert" className="text-sm text-error border border-error/30 bg-[#fbeeeb] rounded-sm px-4 py-2">
        {error}
      </p>
    );
  }
  if (typeof ok === "string") {
    return (
      <p role="status" className="text-sm text-success border border-success/30 bg-[#eef6ef] rounded-sm px-4 py-2">
        {ok}
      </p>
    );
  }
  return null;
}