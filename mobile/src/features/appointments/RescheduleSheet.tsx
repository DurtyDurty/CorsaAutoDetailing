import { useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { OVERRIDABLE, type AppointmentDetail } from "@shared/api";
import { ApiClientError } from "@/api/client";
import { newRequestId, useReschedule } from "@/api/queries";
import { Button } from "@/design/Button";
import { Text } from "@/design/Text";
import { colors, MIN_TOUCH, radius, space } from "@/design/theme";
import { pickerDate, pickerTime } from "@/lib/format";

const DURATIONS = [60, 90, 120, 180, 240, 300, 360];
const durationLabel = (m: number) => (m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)}.5 hr`);

/** Move a job to a new time, with the same checks as booking. */
export function RescheduleSheet({ appt, visible, onClose }: { appt: AppointmentDetail; visible: boolean; onClose: () => void }) {
  const move = useReschedule(appt.id);
  const [when, setWhen] = useState(() => new Date(appt.startsAt));
  const [minutes, setMinutes] = useState(() => Math.round((Date.parse(appt.endsAt) - Date.parse(appt.startsAt)) / 60_000));
  const [notify, setNotify] = useState(true);
  const requestId = useRef(newRequestId());

  const submit = (override: boolean) =>
    move.mutate(
      { requestId: requestId.current, date: pickerDate(when), time: pickerTime(when), durationMinutes: minutes, override, notifyCustomer: notify },
      {
        onSuccess: (res) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          requestId.current = newRequestId();
          const note =
            res.customerEmail.status === "sent"
              ? "The customer was emailed the new time."
              : res.customerEmail.status === "failed"
                ? `The email to the customer didn't send: ${res.customerEmail.error ?? "unknown error"}.`
                : "The customer wasn't emailed.";
          Alert.alert("Moved", note);
          onClose();
        },
        onError: (err) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          if (err instanceof ApiClientError && err.code === "conflict" && err.fields?.override === OVERRIDABLE) {
            Alert.alert("Outside your schedule", err.message, [
              { text: "Change time", style: "cancel" },
              { text: "Move anyway", onPress: () => submit(true) },
            ]);
            return;
          }
          const offline = err instanceof ApiClientError && (err.code === "network" || err.code === "timeout");
          if (!offline) requestId.current = newRequestId();
          Alert.alert("Not moved", err.message);
        },
      },
    );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <Text variant="title">Reschedule</Text>
            <Button label="Close" variant="ghost" onPress={onClose} />
          </View>
          <Text variant="caption">{appt.customerName} · {appt.serviceName ?? "Service"}</Text>
          <Text variant="label">New time (Eastern)</Text>
          <View style={styles.pickers}>
            <DateTimePicker value={when} mode="date" display={Platform.OS === "ios" ? "compact" : "default"} themeVariant="dark" accentColor={colors.accent} minimumDate={new Date()} onChange={(_, d) => d && setWhen((w) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), w.getHours(), w.getMinutes()))} />
            <DateTimePicker value={when} mode="time" minuteInterval={15} display={Platform.OS === "ios" ? "compact" : "default"} themeVariant="dark" accentColor={colors.accent} onChange={(_, d) => d && setWhen((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate(), d.getHours(), d.getMinutes()))} />
          </View>
          <Text variant="label">How long</Text>
          <View style={styles.wrap}>
            {DURATIONS.map((m) => (
              <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: minutes === m }} onPress={() => setMinutes(m)} style={[styles.chip, minutes === m && styles.chipOn]}>
                <Text variant={minutes === m ? "bodyStrong" : "body"}>{durationLabel(m)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Email the customer</Text>
              <Text variant="caption">Tells them the new day and time, from your business email.</Text>
            </View>
            <Switch value={notify} onValueChange={setNotify} trackColor={{ true: colors.accent }} accessibilityLabel="Email the customer" />
          </View>
          <Button label="Move appointment" haptic="medium" loading={move.isPending} onPress={() => submit(false)} fullWidth />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickers: { flexDirection: "row", gap: space.md, alignItems: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: MIN_TOUCH, minWidth: 72, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
});