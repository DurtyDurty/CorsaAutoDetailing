import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { QUOTE_MAX_LINES, type AppointmentDetail, type QuoteDraft } from "@shared/api";
import { formatCents } from "@shared/money";
import { ApiClientError } from "@/api/client";
import { newRequestId, useSendQuote } from "@/api/queries";
import { Button } from "@/design/Button";
import { Field } from "@/design/Field";
import { Segmented } from "@/design/Segmented";
import { Text } from "@/design/Text";
import { colors, radius, space } from "@/design/theme";

type Line = { key: string; label: string; amount: string };
type Days = "1" | "2" | "3" | "5" | "7";

const dollars = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
const toCents = (s: string) => {
  const t = s.replace(/[$,\s]/g, "");
  return t === "" ? 0 : Math.round(Number(t) * 100);
};
let seq = 0;
const line = (label: string, cents: number): Line => ({ key: `l${seq++}`, label, amount: cents ? dollars(cents) : "" });

/**
 * Price a website request and email the customer the quote (PDF + link). The
 * customer accepting it confirms the job. Starts from the earlier quote, or
 * from the requested package.
 */
export function QuoteSheet({ appt, draft, visible, onClose }: { appt: AppointmentDetail; draft: QuoteDraft; visible: boolean; onClose: () => void }) {
  const send = useSendQuote(appt.id);
  const prior = appt.quote && appt.quote.status !== "accepted" ? appt.quote : null;
  const [lines, setLines] = useState<Line[]>(() => (prior?.lines ?? draft.lines).map((l) => line(l.label, l.amountCents)));
  const [discount, setDiscount] = useState(() => (prior?.discountCents ? dollars(prior.discountCents) : ""));
  const [notes, setNotes] = useState(prior?.notes ?? "");
  const [days, setDays] = useState<Days>(String(draft.defaultExpiresInDays) as Days);
  const [error, setError] = useState<string | null>(null);
  // One id per intended send: a retry after a dropped connection sends once.
  const requestId = useRef(newRequestId());

  const subtotal = lines.reduce((s, l) => s + (Number.isFinite(toCents(l.amount)) ? toCents(l.amount) : 0), 0);
  const discountCents = toCents(discount);
  const total = subtotal - (Number.isFinite(discountCents) ? discountCents : 0);
  const unused = draft.extras.filter((x) => !lines.some((l) => l.label === x.label));

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = () => {
    const payload = lines
      .map((l) => ({ label: l.label.trim(), amountCents: toCents(l.amount) }))
      .filter((l) => l.label !== "" || l.amountCents !== 0);
    if (payload.some((l) => !l.label)) return setError("Describe each line.");
    if (payload.some((l) => !Number.isFinite(l.amountCents) || l.amountCents < 0)) return setError("Check the amounts.");
    if (!Number.isFinite(discountCents) || discountCents < 0) return setError("Check the discount.");
    if (payload.length === 0 || total <= 0) return setError("The total must be more than $0.");
    setError(null);
    Alert.alert(`Send ${formatCents(total)} quote?`, `${appt.customerName} gets it by email with a PDF and a link to accept. Accepting confirms the job.`, [
      { text: "Not yet", style: "cancel" },
      {
        text: "Send",
        onPress: () =>
          send.mutate(
            { requestId: requestId.current, lines: payload, discountCents, notes: notes.trim() || undefined, expiresInDays: Number(days) },
            {
              onSuccess: (res) => {
                requestId.current = newRequestId();
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  res.customerEmail.status === "failed" ? "Quote saved, email failed" : "Quote sent",
                  res.customerEmail.status === "failed" ? (res.customerEmail.error ?? "") : `${res.quote.number} · ${formatCents(res.quote.totalCents)} to ${appt.email}.`,
                );
                onClose();
              },
              onError: (err) => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                const offline = err instanceof ApiClientError && (err.code === "network" || err.code === "timeout");
                if (!offline) requestId.current = newRequestId();
                setError(err.message);
              },
            },
          ),
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <Text variant="title">{prior ? "Revise quote" : "Send quote"}</Text>
              <Button label="Close" variant="ghost" onPress={onClose} />
            </View>
            <Text variant="caption">
              {appt.customerName} · {appt.serviceName ?? "Service"}
            </Text>

            {lines.map((l, i) => (
              <View key={l.key} style={styles.line}>
                <View style={styles.lineLabel}>
                  <Field label={`Line ${i + 1}`} value={l.label} onChangeText={(v) => update(l.key, { label: v })} maxLength={80} placeholder="Description" />
                </View>
                <View style={styles.lineAmount}>
                  <Field label="$" value={l.amount} onChangeText={(v) => update(l.key, { amount: v })} keyboardType="decimal-pad" placeholder="0" />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove line ${i + 1}`}
                  onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  style={styles.remove}
                  hitSlop={8}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {unused.length > 0 && lines.length < QUOTE_MAX_LINES && (
              <View style={styles.extras}>
                <Text variant="label">Add an extra</Text>
                <View style={styles.chips}>
                  {unused.map((x) => (
                    <Pressable
                      key={x.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${x.label}`}
                      onPress={() => setLines((ls) => [...ls, line(x.label, x.minCents)])}
                      style={styles.chip}
                    >
                      <Text variant="caption">
                        + {x.label} ({x.minCents === x.maxCents ? formatCents(x.minCents) : `${formatCents(x.minCents)}–${formatCents(x.maxCents)}`})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {lines.length < QUOTE_MAX_LINES && <Button label="+ Add a line" variant="secondary" onPress={() => setLines((ls) => [...ls, line("", 0)])} />}

            <Field label="Discount ($)" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="0" />
            <Field label="Note to the customer (optional)" value={notes} onChangeText={setNotes} multiline maxLength={1000} placeholder="Shown on the quote" />
            <Text variant="label">Customer has to answer within</Text>
            <Segmented
              label="Quote valid for"
              value={days}
              onChange={setDays}
              options={[
                { value: "1", label: "1 day" },
                { value: "2", label: "2" },
                { value: "3", label: "3" },
                { value: "5", label: "5" },
                { value: "7", label: "7" },
              ]}
            />

            <View style={styles.total}>
              <Text variant="label" style={styles.totalLabel}>
                Total
              </Text>
              <Text variant="title" style={styles.totalValue}>
                {formatCents(Math.max(0, total))}
              </Text>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Button label={prior ? "Send revised quote" : "Send quote"} haptic="medium" loading={send.isPending} onPress={submit} fullWidth />
            <Text variant="caption">The time stays held until the quote expires (never past the appointment). Sending again replaces the open quote.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  line: { flexDirection: "row", gap: space.sm, alignItems: "flex-end" },
  lineLabel: { flex: 1 },
  lineAmount: { width: 96 },
  remove: { paddingBottom: space.md, paddingHorizontal: space.xs },
  removeText: { color: colors.textMuted, fontSize: 18 },
  extras: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  total: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderLeftWidth: 4, borderLeftColor: colors.accent, backgroundColor: colors.surfaceRaised, padding: space.md },
  totalLabel: { color: colors.textMuted },
  totalValue: { color: colors.text },
  error: { color: colors.error },
});
