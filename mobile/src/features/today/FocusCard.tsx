import { useRef } from "react";
import { Alert, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { AppointmentSummary } from "@shared/api";
import { formatCents } from "@shared/money";
import { ApiClientError } from "@/api/client";
import { newRequestId, useChangeStatus } from "@/api/queries";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { StatusPill } from "@/design/StatusPill";
import { Text } from "@/design/Text";
import { space } from "@/design/theme";
import { nextStep } from "@/features/appointments/next-step";
import { addressLine, formatShortDay, formatTimeRange, vehicleLine } from "@/lib/format";
import { callPhone, navigateTo, textPhone } from "@/lib/native";

/** The job that matters right now: underway, or next up. */
export function FocusCard({ appt, isToday }: { appt: AppointmentSummary; isToday: boolean }) {
  const change = useChangeStatus();
  // One request id per intended change: a retry after a dropped connection reuses it.
  const pending = useRef<{ to: string; id: string } | null>(null);
  const step = nextStep(appt.status);
  const vehicle = vehicleLine(appt.vehicle);
  const address = addressLine(appt);
  const underway = appt.status === "en_route" || appt.status === "arrived" || appt.status === "in_progress";

  const apply = () => {
    if (!step) return;
    if (pending.current?.to !== step.to) pending.current = { to: step.to, id: newRequestId() };
    change.mutate(
      { id: appt.id, to: step.to, requestId: pending.current.id },
      {
        onSuccess: (res) => {
          pending.current = null;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Close-out: a finished job with money still owed goes straight to recording the payment.
          const due = res.appointment.balance.balanceDueCents;
          if (step.to === "completed" && due > 0) {
            Alert.alert("Job complete", `${formatCents(due)} is still due. Record the payment now?`, [
              { text: "Later", style: "cancel" },
              { text: "Record payment", onPress: () => router.push({ pathname: "/appointment/[id]", params: { id: appt.id } }) },
            ]);
          }
        },
        onError: (err) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const offline = err instanceof ApiClientError && (err.code === "network" || err.code === "timeout");
          if (!offline) pending.current = null;
          Alert.alert(offline ? "Not sent yet" : "Couldn't update", err.message);
        },
      },
    );
  };

  const onStep = () => {
    if (!step) return;
    if (step.confirm) {
      Alert.alert(step.confirm.title, step.confirm.message, [
        { text: "Not yet", style: "cancel" },
        { text: step.label, onPress: apply },
      ]);
    } else {
      apply();
    }
  };

  return (
    <Card accent style={styles.card}>
      <View style={styles.top}>
        <Text variant="label">{underway ? "Current job" : isToday ? "Next job" : `Next job · ${formatShortDay(appt.startsAt)}`}</Text>
        <StatusPill status={appt.status} />
      </View>
      <View style={styles.block}>
        <Text variant="title">{appt.customerName}</Text>
        <Text variant="bodyStrong">{appt.serviceName ?? "Service not set"}</Text>
        <Text variant="caption">{formatTimeRange(appt.startsAt, appt.endsAt)}</Text>
        {vehicle && <Text variant="body">{vehicle}</Text>}
        {address && <Text variant="caption">{address}</Text>}
        {appt.balance.balanceDueCents > 0 && (
          <Text variant="caption">
            {formatCents(appt.balance.balanceDueCents)} due
            {appt.balance.depositPaidCents > 0 ? ` · ${formatCents(appt.balance.depositPaidCents)} deposit paid` : ""}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        {appt.phone && (
          <>
            <Button label="Call" variant="secondary" onPress={() => void callPhone(appt.phone!)} style={styles.action} />
            <Button label="Text" variant="secondary" onPress={() => void textPhone(appt.phone!)} style={styles.action} />
          </>
        )}
        {address && <Button label="Navigate" variant="secondary" onPress={() => void navigateTo(address)} style={styles.action} />}
      </View>
      {step && <Button label={step.label} haptic="medium" loading={change.isPending} onPress={onStep} fullWidth />}
      <Button label="Details, payment & notes" variant="ghost" onPress={() => router.push({ pathname: "/appointment/[id]", params: { id: appt.id } })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  block: { gap: space.xs },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
});