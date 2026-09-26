"use client";

import { useId, useState } from "react";
import { isValidZip, lookupZip } from "@/lib/zip";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Client-only, purely informational ZIP classifier. Nothing is sent anywhere. */
export function ZipChecker() {
  const id = useId();
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<ReturnType<typeof lookupZip> | "invalid" | null>(null);

  return (
    <form
      className="border border-line bg-white rounded-md p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setResult(isValidZip(zip) ? lookupZip(zip) : "invalid");
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        ZIP code
      </label>
      <div className="mt-2 flex flex-col sm:flex-row gap-3">
        <input
          id={id}
          className="field sm:max-w-[10rem]"
          inputMode="numeric"
          maxLength={5}
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
          aria-describedby={`${id}-result`}
          autoComplete="postal-code"
        />
        <Button type="submit" variant="secondary">
          Check
        </Button>
      </div>
      <p
        id={`${id}-result`}
        role="status"
        className={cn(
          "mt-4 text-sm leading-relaxed min-h-5",
          result === "invalid" && "text-error",
          result && result !== "invalid" && result.eligibility === "core" && "text-success",
          result && result !== "invalid" && result.eligibility !== "core" && "text-ink-muted",
        )}
      >
        {result === "invalid" ? "Enter a 5-digit ZIP code." : result ? result.message : ""}
      </p>
    </form>
  );
}
