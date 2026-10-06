import { focusManager, onlineManager, QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { randomUUID } from "expo-crypto";
import { AppState, Platform } from "react-native";
import type {
  AppointmentDetail,
  AppointmentSummary,
  BookingOptions,
  RecordPaymentInput,
  RescheduleInput,
  WorkResponse,
  ConversationDetail,
  ConversationSummary,
  CreateAppointmentInput,
  CreateAppointmentResponse,
  CustomerOption,
  MeResponse,
  Page,
  SendMessageInput,
  SendMessageResponse,
  SendQuoteInput,
  SendQuoteResponse,
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
  appointments: (from: string, to: string) => ["appointments", from, to] as const,
  appointmentsAll: ["appointments"] as const,
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
      void qc.invalidateQueries({ queryKey: keys.appointmentsAll });
    },
  });
}

export const newRequestId = () => randomUUID();
/* ---------- Inbox ---------- */

export function useConversations(filter: "all" | "unread" | "archived", q: string) {
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
export function useArchive(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) =>
      apiRequest<ConversationDetail>(`/conversations/${leadId}/archive`, { method: "POST", body: { archived } }),
    onSuccess: (data) => refreshInbox(qc, data),
  });
}

/** Permanent. The caller must have asked the owner first. */
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => apiRequest<{ deleted: true }>(`/conversations/${leadId}?confirm=delete`, { method: "DELETE" }),
    onSuccess: (_d, leadId) => {
      qc.removeQueries({ queryKey: keys.conversation(leadId) });
      void qc.invalidateQueries({ queryKey: keys.conversationsAll });
      void qc.invalidateQueries({ queryKey: keys.summary });
    },
  });
}
/* ---------- Calendar and job details ---------- */

/** Every appointment overlapping [from, to] (all pages). */
export function useAppointments(from: string, to: string) {
  return useQuery({
    queryKey: keys.appointments(from, to),
    queryFn: async ({ signal }) => {
      const items: AppointmentSummary[] = [];
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ from, to, limit: "200" });
        if (cursor) params.set("cursor", cursor);
        const page: Page<AppointmentSummary> = await apiRequest<Page<AppointmentSummary>>(`/appointments?${params}`, { signal });
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return items;
    },
    refetchInterval: 60_000,
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: keys.appointment(id),
    queryFn: ({ signal }) => apiRequest<AppointmentDetail>(`/appointments/${id}`, { signal }),
    enabled: !!id,
  });
}

/** After any change to a job: refresh it, Today, the calendar and its conversation. */
function refreshJob(qc: ReturnType<typeof useQueryClient>, detail: AppointmentDetail) {
  qc.setQueryData(keys.appointment(detail.id), detail);
  void qc.invalidateQueries({ queryKey: keys.summary });
  void qc.invalidateQueries({ queryKey: keys.appointmentsAll });
  void qc.invalidateQueries({ queryKey: keys.conversation(detail.leadId) });
}

function useWork<V>(path: (v: V) => string, body: (v: V) => unknown) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => apiRequest<WorkResponse>(path(v), { method: "POST", body: body(v) }),
    onSuccess: (data) => refreshJob(qc, data.appointment),
  });
}

export const useReschedule = (id: string) => useWork<RescheduleInput>(() => `/appointments/${id}/reschedule`, (v) => v);
export const useRecordPayment = (id: string) => useWork<RecordPaymentInput>(() => `/appointments/${id}/payments`, (v) => v);
export const useSendReceipt = (id: string) => useWork<{ requestId: string }>(() => `/appointments/${id}/receipt`, (v) => v);
export const useAddNote = (id: string) => useWork<{ requestId: string; note: string }>(() => `/appointments/${id}/notes`, (v) => v);

export function useSendQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SendQuoteInput) => apiRequest<SendQuoteResponse>(`/appointments/${id}/quote`, { method: "POST", body: v }),
    onSuccess: (data) => refreshJob(qc, data.appointment),
  });
}