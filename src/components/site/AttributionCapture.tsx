"use client";

import { useEffect } from "react";
import { captureTouch } from "@/lib/attribution-client";

/** Keeps the landing page's campaign tags and ad click id so a later booking can be credited to them. */
export function AttributionCapture() {
  useEffect(() => {
    captureTouch();
  }, []);
  return null;
}
