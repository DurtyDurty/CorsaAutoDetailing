import { focusManager, onlineManager, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { randomUUID } from "expo-crypto";
import { AppState, Platform } from "react-native";
import type { MeResponse, SessionTokens, SignInInput, StatusChangeResponse, TodaySummary } from "@shared/api";
import type { AppointmentStatus } from "@shared/appointment-status";
import { ApiClientError, apiRequest } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Don't hammer a server that said no; do retry flaky connections.
      retry: (count, err) => err instanceof ApiClientError && (err.code === "network" || err.code === "timeout") && count < 2,
    },
    mutations: { retry: false },
  },
});

/** Refetch when the app comes back to the foreground, and pause while offline. */
export function wireQueryLifecycle(): () => void {
  const appState = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") focusManager.setFocused(s === "active");
  });
  const unsubscribeNet = NetInfo.addEventListener((s) => onlineManager.setOnline(s.isConnected !== false));
  return () => {
    appState.remove();
    unsubscribeNet();
  };
}

export const keys = {
  me: ["me"] as const,
  summary: ["summary"] as const,
  appointment: (id: string) => ["appointment", id] as const,
};

export function useSummary() {
  return useQuery({
    queryKey: keys.summary,
    queryFn: ({ signal }) => apiRequest<TodaySummary>("/summary", { signal }),
    // New website bookings show up without pulling to refresh.
    refetchInterval: 30_000,
  });
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: ({ signal }) => apiRequest<MeResponse>("/me", { signal }), staleTime: 5 * 60_000 });
}

export function signIn(input: SignInInput) {
  return apiRequest<SessionTokens>("/session", { method: "POST", body: input, auth: false });
}

export function signOutRemote(scope: "local" | "global") {
  return apiRequest<{ ok: true }>(`/session${scope === "global" ? "?scope=global" : ""}`, { method: "DELETE" });
}

interface StatusVars {
  id: string;
  to: AppointmentStatus;
  reason?: string;
  cancelledBy?: "customer" | "owner";
}

/**
 * Change an appointment's status. The request id is created once per tap, so
 * if the network drops and the request is retried, the server applies it once.
 */
export function useChangeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: StatusVars & { requestId: string }) =>
      apiRequest<StatusChangeResponse>(`/appointments/${v.id}/status`, {
        method: "POST",
        body: { to: v.to, reason: v.reason, cancelledBy: v.cancelledBy, requestId: v.requestId },
      }),
    onSuccess: (data) => {
      qc.setQueryData(keys.appointment(data.appointment.id), data.appointment);
      void qc.invalidateQueries({ queryKey: keys.summary });
    },
  });
}

export const newRequestId = () => randomUUID();