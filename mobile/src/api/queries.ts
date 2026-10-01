import { focusManager, onlineManager, QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { randomUUID } from "expo-crypto";
import { AppState, Platform } from "react-native";
import type {
  BookingOptions,
  ConversationDetail,
  ConversationSummary,
  CreateAppointmentInput,
  CreateAppointmentResponse,
  CustomerOption,
  MeResponse,
  Page,
  SendMessageInput,
  SendMessageResponse,
  SessionTokens,
  SignInInput,
  StatusChangeResponse,
  TodaySummary,
} from "@shared/api";
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
  conversations: (filter: string, q: string) => ["conversations", filter, q] as const,
  conversationsAll: ["conversations"] as const,
  conversation: (leadId: string) => ["conversation", leadId] as const,
  bookingOptions: ["booking-options"] as const,
  customers: (q: string) => ["customers", q] as const,
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
/* ---------- Inbox ---------- */

export function useConversations(filter: "all" | "unread", q: string) {
  return useInfiniteQuery({
    queryKey: keys.conversations(filter, q),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ filter, limit: "40" });
      if (q) params.set("q", q);
      if (pageParam) params.set("cursor", pageParam);
      return apiRequest<Page<ConversationSummary>>(`/conversations?${params}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: 60_000,
  });
}

export function useConversation(leadId: string, enabled = true) {
  return useQuery({
    queryKey: keys.conversation(leadId),
    queryFn: ({ signal }) => apiRequest<ConversationDetail>(`/conversations/${leadId}`, { signal }),
    enabled: enabled && !!leadId,
  });
}

function refreshInbox(qc: ReturnType<typeof useQueryClient>, detail: ConversationDetail) {
  qc.setQueryData(keys.conversation(detail.leadId), detail);
  void qc.invalidateQueries({ queryKey: keys.conversationsAll });
  void qc.invalidateQueries({ queryKey: keys.summary });
}

export function useSendMessage(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) =>
      apiRequest<SendMessageResponse>(`/conversations/${leadId}/messages`, { method: "POST", body: input }),
    onSuccess: (data) => refreshInbox(qc, data.conversation),
    // A failed send is recorded on the server; show it in the thread.
    onError: () => void qc.invalidateQueries({ queryKey: keys.conversation(leadId) }),
  });
}

export function useMarkHandled(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<ConversationDetail>(`/conversations/${leadId}/handled`, { method: "POST" }),
    onSuccess: (data) => refreshInbox(qc, data),
  });
}

/* ---------- Booking ---------- */

export function useBookingOptions() {
  return useQuery({
    queryKey: keys.bookingOptions,
    queryFn: ({ signal }) => apiRequest<BookingOptions>("/booking-options", { signal }),
    staleTime: 10 * 60_000,
  });
}

export function useCustomerSearch(q: string) {
  return useQuery({
    queryKey: keys.customers(q),
    queryFn: ({ signal }) =>
      apiRequest<{ items: CustomerOption[] }>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`, { signal }),
    placeholderData: (prev) => prev,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) =>
      apiRequest<CreateAppointmentResponse>("/appointments", { method: "POST", body: input }),
    onSuccess: (data) => {
      qc.setQueryData(keys.appointment(data.appointment.id), data.appointment);
      void qc.invalidateQueries({ queryKey: keys.summary });
      void qc.invalidateQueries({ queryKey: keys.conversationsAll });
      void qc.invalidateQueries({ queryKey: keys.conversation(data.appointment.leadId) });
    },
  });
}