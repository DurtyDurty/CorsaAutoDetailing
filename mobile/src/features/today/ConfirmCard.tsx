import { useRef } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { QUOTE_STATUS_LABELS, type AppointmentSummary, type StatusChangeResponse } from "@shared/api";
import { formatCents } from "@shared/money";
import { ApiClientError } from "@/api/client";
import { newRequestId, useChangeStatus } from "@/api/queries";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";
import { addressLine, formatShortDay, formatTimeRange, vehicleLine } from "@/lib/format";
import { callPhone } from "@/lib/native";

type Decision = "declined";

function emailNote(res: StatusChangeResponse): string {
  const e = res.customerEmail;
  if (!e) return "";
  return e.status === "sent" ? " The customer was emailed." : ` The email to the customer didn't send: ${e.error ?? "unknown error"}.`;
}

/** A held time waiting on a quote: one a customer picked on the website, or one the owner entered to quote. */
export function ConfirmCard({ appt }: { appt: AppointmentSummary }) {
  const change = useChangeStatus();
  const pending = useRef<{ to: Decision; id: string } | null>(null);
  const vehicle = vehicleLine(appt.vehicle);
  const address = addressLine(appt);
  // Entered by the owner: there's no customer request to decline, only his own quote to drop.
  const mine = appt.source === "owner";

  const decide = (to: Decision) => {
    if (pending.current?.to !== to) pending.current = { to, id: newRequestId() };
    change.mutate(
      {
        id: appt.id,
        to,
        requestId: pending.current.id,
        ...(to === "declined" ? { reason: mine ? "Quote dropped by owner" : "Requested time not available" } : {}),
      },
      {
        onSuccess: (res) => {
          pending.current = null;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(mine ? "Dropped" : "Declined", `${appt.customerName}.${emailNote(res)}`);
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

  return (
    <Card style={styles.card} accessibilityLabel={`${mine ? "Your quote for" : "Request from"} ${appt.customerName} for ${formatShortDay(appt.startsAt)}`}>
      <Text variant="label" style={styles.label}>
        {mine ? "Your quote" : "Requested"} · {formatShortDay(appt.startsAt)}
      </Text>
      <View style={styles.block}>
        <Text variant="heading">{appt.customerName}</Text>
        <Text variant="bodyStrong">{appt.serviceName ?? "Service not set"}</Text>
        <Text variant="caption">{appt.requested ? `Asked for: ${appt.requested}` : formatTimeRange(appt.startsAt, appt.endsAt)}</Text>
        {vehicle && <Text variant="body">{vehicle}</Text>}
        {address && <Text variant="caption">{address}</Text>}
        {appt.quotedPriceCents > 0 && <Text variant="caption">Starting price {formatCents(appt.quotedPriceCents)}</Text>}
      </View>
      <View style={styles.actions}>
        <Button
          label={mine ? "Drop" : "Decline"}
          variant="danger"
          disabled={change.isPending}
          onPress={() =>
            Alert.alert(
              mine ? "Drop this quote?" : "Decline this request?",
              mine ? "The time is freed and any quote you sent stops working. The customer isn't emailed." : "The customer gets an email asking them to pick another time.",
              [
                { text: "Keep it", style: "cancel" },
                { text: mine ? "Drop it" : "Decline", style: "destructive", onPress: () => decide("declined") },
              ],
            )
          }
          style={styles.action}
        />
        {appt.phone && <Button label="Call" variant="secondary" onPress={() => void callPhone(appt.phone!)} style={styles.action} />}
        <Button
          label={appt.quoteStatus === "sent" ? "View quote" : "Send quote"}
          haptic="medium"
          disabled={change.isPending}
          onPress={() => router.push({ pathname: "/appointment/[id]", params: { id: appt.id, quote: appt.quoteStatus === "sent" ? "0" : "1" } })}
          style={styles.action}
        />
      </View>
      <Text variant="caption">{appt.quoteStatus ? QUOTE_STATUS_LABELS[appt.quoteStatus] : "Send a quote: the job is confirmed when the customer accepts it."}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, borderColor: colors.warning },
  label: { color: colors.warning },
  block: { gap: space.xs },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
});
