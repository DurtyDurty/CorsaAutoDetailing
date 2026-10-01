import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppointmentDetail } from "@shared/api";
import { formatCents } from "@shared/money";
import { newRequestId, useRecordPayment } from "@/api/queries";
import { ApiClientError } from "@/api/client";
import { Button } from "@/design/Button";
import { Field } from "@/design/Field";
import { Segmented } from "@/design/Segmented";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";

type Method = "card_reader" | "cash" | "digital";

/** Record money collected (or refunded) for a job. Amount starts at the balance due. */
export function PaymentSheet({ appt, visible, onClose, onRecorded }: { appt: AppointmentDetail; visible: boolean; onClose: () => void; onRecorded?: () => void }) {
  const record = useRecordPayment(appt.id);
  const [kind, setKind] = useState<"balance" | "refund">("balance");
  const [method, setMethod] = useState<Method>("card_reader");
  const [amount, setAmount] = useState(() => (appt.balance.balanceDueCents > 0 ? String(appt.balance.balanceDueCents / 100) : ""));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // One id per intended payment: a retry after a dropped connection records it once.
  const requestId = useRef(newRequestId());

  const save = () => {
    const cents = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter an amount.");
      return;
    }
    const go = () =>
      record.mutate(
        { requestId: requestId.current, kind, method, amountCents: cents, note: note.trim() || undefined },
        {
          onSuccess: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            requestId.current = newRequestId();
            setError(null);
            onRecorded?.();
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
    // Refunds and unusually large amounts get a second look.
    if (kind === "refund" || cents > Math.max(appt.balance.totalCents, 1) * 1.5) {
      Alert.alert(kind === "refund" ? `Record a ${formatCents(cents)} refund?` : `Record ${formatCents(cents)}?`, kind === "refund" ? "This lowers the amount collected for this job." : "That's well over the job's price.", [
        { text: "Cancel", style: "cancel" },
        { text: "Record", onPress: go },
      ]);
    } else go();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <Text variant="title">{kind === "refund" ? "Record refund" : "Record payment"}</Text>
              <Button label="Close" variant="ghost" onPress={onClose} />
            </View>
            <Text variant="caption">
              {appt.customerName} · total {formatCents(appt.balance.totalCents)} · collected {formatCents(appt.balance.collectedCents)} · due{" "}
              {formatCents(appt.balance.balanceDueCents)}
            </Text>
            <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: "balance", label: "Payment" }, { value: "refund", label: "Refund" }]} />
            <Text variant="label">How</Text>
            <Segmented
              label="Payment method"
              value={method}
              onChange={setMethod}
              options={[
                { value: "card_reader", label: "Card" },
                { value: "cash", label: "Cash" },
                { value: "digital", label: "Digital" },
              ]}
            />
            <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={error ?? undefined} />
            <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Zelle, tip included" maxLength={500} />
            <Button label={kind === "refund" ? "Record refund" : "Record payment"} haptic="medium" loading={record.isPending} onPress={save} fullWidth />
            <Text variant="caption">Card details are never entered here: take the card on your reader, then record the amount.</Text>
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