import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppointmentDetail } from "@shared/api";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@shared/appointment-status";
import { formatCents, PAYMENT_METHOD_LABELS } from "@shared/money";
import { ApiClientError } from "@/api/client";
import { newRequestId, useAddNote, useAppointment, useChangeStatus, useSendReceipt } from "@/api/queries";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Field } from "@/design/Field";
import { Skeleton } from "@/design/Skeleton";
import { ErrorState } from "@/design/States";
import { StatusPill } from "@/design/StatusPill";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";
import { nextStep } from "@/features/appointments/next-step";
import { PaymentSheet } from "@/features/appointments/PaymentSheet";
import { RescheduleSheet } from "@/features/appointments/RescheduleSheet";
import { addressLine, formatShortDay, formatTime, formatTimeRange, vehicleLine } from "@/lib/format";
import { callPhone, navigateTo, sendEmail, textPhone } from "@/lib/native";

const offline = (err: unknown) => err instanceof ApiClientError && (err.code === "network" || err.code === "timeout");

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text variant="caption" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="body" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

/** Status changes from this screen: one request id per intended change, so a retry applies once. */
function useStatusAction(a: AppointmentDetail) {
  const change = useChangeStatus();
  const pending = useRef<{ to: AppointmentStatus; id: string } | null>(null);
  const run = (to: AppointmentStatus, extra: { reason?: string; cancelledBy?: "customer" | "owner" } = {}, after?: () => void) => {
    if (pending.current?.to !== to) pending.current = { to, id: newRequestId() };
    change.mutate(
      { id: a.id, to, requestId: pending.current.id, ...extra },
      {
        onSuccess: (res) => {
          pending.current = null;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (res.customerEmail?.status === "failed") Alert.alert("Updated", `The email to the customer didn't send: ${res.customerEmail.error ?? ""}`);
          after?.();
        },
        onError: (err) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          if (!offline(err)) pending.current = null;
          Alert.alert(offline(err) ? "Not sent yet" : "Couldn't update", err.message);
        },
      },
    );
  };
  return { run, busy: change.isPending };
}

function askReason(title: string, onReason: (reason: string) => void) {
  if (Platform.OS === "ios") {
    Alert.prompt(title, "A short reason, for your records. The customer doesn't see it.", [
      { text: "Back", style: "cancel" },
      { text: "Save", style: "destructive", onPress: (v?: string) => onReason(v?.trim() || "No reason given") },
    ]);
  } else {
    onReason("No reason given");
  }
}

function Body({ a }: { a: AppointmentDetail }) {
  const status = useStatusAction(a);
  const receipt = useSendReceipt(a.id);
  const addNote = useAddNote(a.id);
  const [paying, setPaying] = useState(false);
  const [moving, setMoving] = useState(false);
  const [note, setNote] = useState("");
  const noteId = useRef(newRequestId());
  const receiptId = useRef(newRequestId());

  const step = nextStep(a.status);
  const allowed = new Set(a.allowedTransitions);
  const vehicle = vehicleLine(a.vehicle);
  const address = addressLine(a);
  const b = a.balance;
  const closedOut = a.status === "completed" && b.balanceDueCents === 0;

  const onStep = () => {
    if (!step) return;
    const go = () =>
      status.run(step.to, {}, () => {
        // Close-out: after completing, collect what's still owed.
        if (step.to === "completed" && b.balanceDueCents > 0) {
          Alert.alert("Job complete", `${formatCents(b.balanceDueCents)} is still due. Record the payment now?`, [
            { text: "Later", style: "cancel" },
            { text: "Record payment", onPress: () => setPaying(true) },
          ]);
        }
      });
    if (step.confirm) {
      Alert.alert(step.confirm.title, step.confirm.message, [
        { text: "Not yet", style: "cancel" },
        { text: step.label, onPress: go },
      ]);
    } else go();
  };

  const cancel = () =>
    Alert.alert("Cancel this appointment?", "This frees the time. You can't undo it, but you can book them again.", [
      { text: "Keep it", style: "cancel" },
      { text: "Customer cancelled", onPress: () => askReason("Why did they cancel?", (reason) => status.run("cancelled", { reason, cancelledBy: "customer" })) },
      { text: "I'm cancelling", style: "destructive", onPress: () => askReason("Why are you cancelling?", (reason) => status.run("cancelled", { reason, cancelledBy: "owner" })) },
    ]);

  const noShow = () =>
    Alert.alert("Mark as no-show?", "The customer wasn't there for the appointment.", [
      { text: "Back", style: "cancel" },
      { text: "Mark no-show", style: "destructive", onPress: () => askReason("Any details?", (reason) => status.run("no_show", { reason })) },
    ]);

  const sendReceipt = () =>
    receipt.mutate(
      { requestId: receiptId.current },
      {
        onSuccess: (res) => {
          receiptId.current = newRequestId();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(res.customerEmail.status === "sent" ? "Receipt sent" : "Receipt not sent", res.customerEmail.status === "sent" ? `Emailed to ${a.email}.` : (res.customerEmail.error ?? ""));
        },
        onError: (err) => {
          if (!offline(err)) receiptId.current = newRequestId();
          Alert.alert("Receipt not sent", err.message);
        },
      },
    );

  const saveNote = () =>
    addNote.mutate(
      { requestId: noteId.current, note: note.trim() },
      {
        onSuccess: () => {
          noteId.current = newRequestId();
          setNote("");
        },
        onError: (err) => {
          if (!offline(err)) noteId.current = newRequestId();
          Alert.alert("Note not saved", err.message);
        },
      },
    );

  const privateNotes = a.events.filter((e) => e.type === "note" && e.actor !== "website" && e.actor !== "stripe");

  return (
    <>
      <View style={styles.top}>
        <StatusPill status={a.status} />
        <Text variant="title">{a.customerName}</Text>
        <Text variant="bodyStrong">{a.serviceName ?? "Service not set"}</Text>
        <Text variant="caption">
          {formatShortDay(a.startsAt)} · {formatTimeRange(a.startsAt, a.endsAt)}
        </Text>
      </View>

      {step && <Button label={step.label} haptic="medium" loading={status.busy} onPress={onStep} fullWidth />}
      {a.status === "completed" && b.balanceDueCents > 0 && (
        <Button label={`Collect ${formatCents(b.balanceDueCents)}`} haptic="medium" onPress={() => setPaying(true)} fullWidth />
      )}
      {closedOut && (
        <Card style={styles.done}>
          <Text variant="bodyStrong" style={styles.doneText}>
            ✓ Closed out: completed and paid in full
          </Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text variant="label">Customer</Text>
        <Row label="Phone" value={a.phone} />
        <Row label="Email" value={a.email} />
        <Row label="Address" value={address} />
        <Row label="Prefers" value={a.customer.preferredContact} />
        <View style={styles.actions}>
          {a.phone && <Button label="Call" variant="secondary" onPress={() => void callPhone(a.phone!)} style={styles.action} />}
          {a.phone && <Button label="Text" variant="secondary" onPress={() => void textPhone(a.phone!)} style={styles.action} />}
          {address && <Button label="Navigate" variant="secondary" onPress={() => void navigateTo(address)} style={styles.action} />}
        </View>
        <View style={styles.actions}>
          <Button label="Email" variant="secondary" onPress={() => router.push({ pathname: "/conversation/[leadId]", params: { leadId: a.leadId } })} style={styles.action} />
          <Button label="Mail app" variant="ghost" onPress={() => void sendEmail(a.email)} style={styles.action} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="label">Job</Text>
        <Row label="Vehicle" value={vehicle ? `${vehicle}${a.vehicle.sizeLabel ? ` (${a.vehicle.sizeLabel})` : ""}` : null} />
        <Row label="Condition" value={a.customerNotes.condition} />
        <Row label="Noted" value={a.customerNotes.conditionFlags.join(", ") || null} />
        <Row label="Concerns" value={a.customerNotes.concerns} />
        <Row label="About the space" value={a.customerNotes.spaceNotes} />
        <Row label="Booked via" value={a.source === "online" ? "Website" : "You"} />
        {a.cancelReason && <Row label={a.status === "cancelled" ? `Cancelled by ${a.cancelledBy ?? "?"}` : "Reason"} value={a.cancelReason} />}
      </Card>

      <Card style={styles.card}>
        <Text variant="label">Money</Text>
        <Row label="Price" value={formatCents(b.totalCents)} />
        {a.discountCents > 0 && <Row label="Discount" value={`-${formatCents(a.discountCents)}`} />}
        {b.depositPaidCents > 0 && <Row label="Deposit paid" value={formatCents(b.depositPaidCents)} />}
        <Row label="Collected" value={formatCents(b.collectedCents)} />
        <Row label="Still due" value={formatCents(b.balanceDueCents)} />
        {b.refundedCents > 0 && <Row label="Refunded" value={formatCents(b.refundedCents)} />}
        {a.payments.map((p) => (
          <Text key={p.id} variant="caption">
            {formatShortDay(p.createdAt)} · {p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Payment"} {formatCents(p.amountCents)} ·{" "}
            {PAYMENT_METHOD_LABELS[p.method]}
            {p.note ? ` · ${p.note}` : ""}
          </Text>
        ))}
        <View style={styles.actions}>
          <Button label="Record payment" variant="secondary" onPress={() => setPaying(true)} disabled={a.status === "held" || a.status === "declined"} style={styles.action} />
          <Button label="Send receipt" variant="secondary" onPress={sendReceipt} loading={receipt.isPending} disabled={b.collectedCents === 0} style={styles.action} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="label">Private notes</Text>
        {privateNotes.map((e) => (
          <Text key={e.id} variant="body">
            {e.note} <Text variant="caption">· {formatShortDay(e.createdAt)}</Text>
          </Text>
        ))}
        <Field label="Add a note" value={note} onChangeText={setNote} placeholder="Gate code, pet, parking…" maxLength={1000} />
        <Button label="Save note" variant="secondary" loading={addNote.isPending} disabled={!note.trim()} onPress={saveNote} />
      </Card>

      {allowed.has("declined") && (
        <Button
          label="Decline request"
          variant="danger"
          onPress={() =>
            Alert.alert("Decline this request?", "The customer gets an email asking them to pick another time.", [
              { text: "Keep it", style: "cancel" },
              { text: "Decline", style: "destructive", onPress: () => status.run("declined", { reason: "Requested time not available" }) },
            ])
          }
        />
      )}
      {(allowed.has("confirmed") || a.status === "confirmed" || allowed.has("cancelled") || allowed.has("no_show")) && (
        <View style={styles.actions}>
          {(a.status === "confirmed" || a.status === "held") && <Button label="Reschedule" variant="secondary" onPress={() => setMoving(true)} style={styles.action} />}
          {allowed.has("no_show") && <Button label="No-show" variant="secondary" onPress={noShow} style={styles.action} />}
          {allowed.has("cancelled") && <Button label="Cancel" variant="danger" onPress={cancel} style={styles.action} />}
        </View>
      )}

      <Card style={styles.card}>
        <Text variant="label">History</Text>
        {a.events.map((e) => (
          <Text key={e.id} variant="caption">
            {formatShortDay(e.createdAt)} {formatTime(e.createdAt)} ·{" "}
            {e.type === "status" && e.toStatus
              ? `${e.fromStatus ? `${APPOINTMENT_STATUS_LABELS[e.fromStatus]} → ` : ""}${APPOINTMENT_STATUS_LABELS[e.toStatus]}`
              : e.type === "created"
                ? "Booked"
                : e.type === "rescheduled"
                  ? "Rescheduled"
                  : e.type === "payment"
                    ? "Payment"
                    : "Note"}
            {e.note ? `: ${e.note}` : ""}
          </Text>
        ))}
      </Card>

      {paying && <PaymentSheet appt={a} visible={paying} onClose={() => setPaying(false)} />}
      {moving && <RescheduleSheet appt={a} visible={moving} onClose={() => setMoving(false)} />}
    </>
  );
}

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, isPending, refetch, isRefetching } = useAppointment(id);
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: data ? APPOINTMENT_STATUS_LABELS[data.status] : "Job" }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.accent} />}
        >
          {isPending ? (
            <>
              <Skeleton height={110} />
              <Skeleton height={180} />
            </>
          ) : !data ? (
            <ErrorState message={error?.message ?? "Couldn't load this job."} onRetry={() => void refetch()} retrying={isRefetching} />
          ) : (
            <Body a={data} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  top: { gap: space.xs },
  card: { gap: space.sm },
  row: { flexDirection: "row", gap: space.md },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  action: { flex: 1 },
  done: { borderColor: colors.success },
  doneText: { color: colors.success },
});
