import { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppointmentDetail } from "@shared/api";
import { formatCents } from "@shared/money";
import { newRequestId, useChangeTotal } from "@/api/queries";
import { ApiClientError } from "@/api/client";
import { Button } from "@/design/Button";
import { Field } from "@/design/Field";
import { Segmented } from "@/design/Segmented";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";

/** Change a booked job's total: extra work asked for on the day, or something taken off. */
export function TotalSheet({ appt, visible, onClose }: { appt: AppointmentDetail; visible: boolean; onClose: () => void }) {
  const change = useChangeTotal(appt.id);
  const [direction, setDirection] = useState<"add" | "off">("add");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  // One id per intended change: a retry after a dropped connection applies it once.
  const requestId = useRef(newRequestId());

  const cents = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);
  const valid = Number.isFinite(cents) && cents > 0;
  const signed = direction === "add" ? cents : -cents;
  const total = appt.balance.totalCents;

  const save = () => {
    if (!label.trim()) return setError("Say what it's for.");
    if (!valid) return setError("Enter an amount.");
    change.mutate(
      { requestId: requestId.current, label: label.trim(), amountCents: signed },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          requestId.current = newRequestId();
          onClose();
        },
        onError: (err) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const offline = err instanceof ApiClientError && (err.code === "network" || err.code === "timeout");
          if (!offline) requestId.current = newRequestId();
          setError(err.message);
        },
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <Text variant="title">Change total</Text>
              <Button label="Close" variant="ghost" onPress={onClose} />
            </View>
            <Text variant="caption">
              {appt.customerName} · total now {formatCents(total)}
              {valid ? ` · new total ${formatCents(Math.max(0, total + signed))}` : ""}
            </Text>
            <Segmented label="Change" value={direction} onChange={setDirection} options={[{ value: "add", label: "Add to total" }, { value: "off", label: "Take off" }]} />
            <Field
              label="What for"
              value={label}
              onChangeText={setLabel}
              placeholder={direction === "add" ? "e.g. Pet hair removal" : "e.g. Skipped the trunk"}
              maxLength={80}
            />
            <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={error ?? undefined} />
            <Button label={direction === "add" ? "Add to total" : "Take off total"} haptic="medium" loading={change.isPending} onPress={save} fullWidth />
            <Text variant="caption">
              No email goes to the customer. {direction === "add" ? "It shows as its own line" : "It shows as a discount"} on the invoice that goes out with the work confirmation.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
