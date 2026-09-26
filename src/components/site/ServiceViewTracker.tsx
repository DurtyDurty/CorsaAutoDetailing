"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function ServiceViewTracker({ service }: { service?: string } = {}) {
  useEffect(() => {
    track("service_viewed", service ? { service } : undefined);
  }, [service]);
  return null;
}
