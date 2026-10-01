import { useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAppointmentSchema, OVERRIDABLE, type CreateAppointmentInput, type CustomerOption, type NewCustomerInput } from "@shared/api";
import { formatCents } from "@shared/money";
import { ApiClientError } from "@/api/client";
import { useBookingOptions, useConversation, useCreateAppointment, useCustomerSearch } from "@/api/queries";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Field } from "@/design/Field";
import { Segmented } from "@/design/Segmented";
import { Skeleton } from "@/design/Skeleton";
import { ErrorState } from "@/design/States";
import { Text } from "@/design/Text";
import { colors, MIN_TOUCH, radius, space } from "@/design/theme";
import { pickerDate, pickerTime } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";

const DURATIONS = [60, 90, 120, 180, 240, 300, 360];
const durationLabel = (m: number) => (m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)}.5 hr`);

function tomorrowAtNine(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

type Errors = Partial<Record<string, string>>;

function Choice({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Text variant={selected ? "bodyStrong" : "body"}>{label}</Text>
      {detail ? <Text variant="caption">{detail}</Text> : null}
    </Pressable>
  );
}

function ExistingCustomer({ selected, onSelect }: { selected: CustomerOption | null; onSelect: (c: CustomerOption) => void }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const { data, isPending } = useCustomerSearch(q);
  return (
    <View style={styles.gap}>
      <Field label="Find customer" value={search} onChangeText={setSearch} placeholder="Name, email, phone or vehicle" autoCapitalize="none" autoCorrect={false} />
      {isPending ? (
        <Skeleton height={56} />
      ) : (
        (data?.items ?? []).slice(0, 8).map((c) => (
          <Choice
            key={c.leadId}
            label={c.name}
            detail={[c.vehicle, c.address].filter(Boolean).join(" · ") || c.email}
            selected={selected?.leadId === c.leadId}
            onPress={() => onSelect(c)}
          />
        ))
      )}
      {data && data.items.length === 0 && <Text variant="caption">No customers match. Switch to “New customer”.</Text>}
    </View>
  );
}

const emptyCustomer = { firstName: "", lastName: "", email: "", phone: "", serviceAddress: "", city: "", zip: "", vehicleYear: "", vehicleMake: "", vehicleModel: "" };

export default function NewAppointmentScreen() {
  const { leadId: presetLeadId } = useLocalSearchParams<{ leadId?: string }>();
  const options = useBookingOptions();
  const preset = useConversation(presetLeadId ?? "", !!presetLeadId);
  const create = useCreateAppointment();
  // One id for this booking, reused if the request is retried or overridden.
  const requestId = useRef(randomUUID());

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [existing, setExisting] = useState<CustomerOption | null>(null);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [when, setWhen] = useState(tomorrowAtNine);
  const [duration, setDuration] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [errors, setErrors] = useState<Errors>({});

  const services = useMemo(() => options.data?.services ?? [], [options.data]);
  const minutes = duration ?? options.data?.defaultDurationMinutes ?? 120;
  const groups = useMemo(() => [...new Set(services.map((s) => s.group))], [services]);
  const setField = (k: keyof typeof emptyCustomer) => (v: string) => setCustomer((c) => ({ ...c, [k]: v }));

  const customerName = presetLeadId ? preset.data?.customerName : mode === "existing" ? existing?.name : customer.firstName;

  const buildInput = (override: boolean): CreateAppointmentInput | null => {
    const raw = {
      requestId: requestId.current,
      customer: presetLeadId
        ? { leadId: presetLeadId }
        : mode === "existing"
          ? existing
            ? { leadId: existing.leadId }
            : undefined
          : {
              new: Object.fromEntries(
                Object.entries(customer).filter(([, v]) => v.trim() !== ""),
              ) as unknown as NewCustomerInput,
            },
      serviceId: serviceId ?? "",
      date: pickerDate(when),
      time: pickerTime(when),
      durationMinutes: minutes,
      priceCents: Math.round(Number(price || "0") * 100),
      notes: notes.trim() || undefined,
      override,
      sendConfirmation,
    };
    const parsed = createAppointmentSchema.safeParse(raw);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const next: Errors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "customer" && !raw.customer) next.customer = "Choose a customer.";
      else next[issue.path.at(-1)?.toString() ?? "form"] ??= issue.message;
    }
    if (!Number.isFinite(Number(price || "0"))) next.priceCents = "Enter a price in dollars.";
    setErrors(next);
    return null;
  };

  const submit = (override = false) => {
    const input = buildInput(override);
    if (!input) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    create.mutate(input, {
      onSuccess: (res) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const email =
          res.confirmation === "sent"
            ? "Confirmation email sent."
            : res.confirmation === "failed"
              ? `The confirmation email didn't send: ${res.confirmationError ?? "unknown error"}. You can resend it from the Inbox.`
              : "No confirmation email was sent.";
        Alert.alert(res.alreadyBooked ? "Already booked" : "Booked", `${res.appointment.customerName} · ${res.appointment.serviceName ?? ""}\n${email}`, [
          { text: "Done", onPress: () => router.back() },
        ]);
      },
      onError: (err) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (err instanceof ApiClientError && err.code === "conflict" && err.fields?.override === OVERRIDABLE) {
          Alert.alert("Outside your schedule", err.message, [
            { text: "Change time", style: "cancel" },
            { text: "Book anyway", onPress: () => submit(true) },
          ]);
          return;
        }
        if (err instanceof ApiClientError && err.fields) setErrors((e) => ({ ...e, ...err.fields }));
        Alert.alert("Not booked", err.message);
      },
    });
  };

  if (options.isPending || (presetLeadId && preset.isPending)) {
    return (
      <View style={[styles.safe, styles.content]}>
        <Skeleton height={120} />
        <Skeleton height={200} />
      </View>
    );
  }
  if (!options.data) {
    return <ErrorState message={options.error?.message ?? "Couldn't load services."} onRetry={() => void options.refetch()} />;
  }
  if (!options.data.bookingOpen) {
    return <ErrorState message="The website is in pre-launch mode, so appointments can't be booked yet." />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.gap}>
            <Text variant="label">Customer</Text>
            {presetLeadId ? (
              <Text variant="title">{preset.data?.customerName ?? "Customer"}</Text>
            ) : (
              <>
                <Segmented
                  label="Customer"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "existing", label: "Existing" },
                    { value: "new", label: "New customer" },
                  ]}
                />
                {mode === "existing" ? (
                  <ExistingCustomer
                    selected={existing}
                    onSelect={(c) => {
                      setExisting(c);
                      const match = services.find((s) => s.id === c.serviceId);
                      if (!serviceId && match) {
                        setServiceId(match.id);
                        setPrice(String(match.priceCents / 100));
                        if (match.durationMinutes) setDuration(match.durationMinutes);
                      }
                    }}
                  />
                ) : (
                  <View style={styles.gap}>
                    <View style={styles.row2}>
                      <View style={styles.flex}>
                        <Field label="First name" value={customer.firstName} onChangeText={setField("firstName")} error={errors.firstName} autoComplete="off" />
                      </View>
                      <View style={styles.flex}>
                        <Field label="Last name" value={customer.lastName} onChangeText={setField("lastName")} autoComplete="off" />
                      </View>
                    </View>
                    <Field label="Email" value={customer.email} onChangeText={setField("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} hint="The confirmation goes here." />
                    <Field label="Phone" value={customer.phone} onChangeText={setField("phone")} error={errors.phone} keyboardType="phone-pad" />
                    <Field label="Service address" value={customer.serviceAddress} onChangeText={setField("serviceAddress")} error={errors.serviceAddress} />
                    <View style={styles.row2}>
                      <View style={styles.flex}>
                        <Field label="City" value={customer.city} onChangeText={setField("city")} />
                      </View>
                      <View style={styles.zip}>
                        <Field label="ZIP" value={customer.zip} onChangeText={setField("zip")} error={errors.zip} keyboardType="number-pad" maxLength={5} />
                      </View>
                    </View>
                    <View style={styles.row2}>
                      <View style={styles.zip}>
                        <Field label="Year" value={customer.vehicleYear} onChangeText={setField("vehicleYear")} error={errors.vehicleYear} keyboardType="number-pad" maxLength={4} />
                      </View>
                      <View style={styles.flex}>
                        <Field label="Make" value={customer.vehicleMake} onChangeText={setField("vehicleMake")} />
                      </View>
                      <View style={styles.flex}>
                        <Field label="Model" value={customer.vehicleModel} onChangeText={setField("vehicleModel")} />
                      </View>
                    </View>
                  </View>
                )}
                {errors.customer ? <Text style={styles.error}>{errors.customer}</Text> : null}
              </>
            )}
          </Card>

          <Card style={styles.gap}>
            <Text variant="label">Service</Text>
            {groups.map((g) => (
              <View key={g} style={styles.gap}>
                {services
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <Choice
                      key={s.id}
                      label={s.name}
                      detail={`from ${formatCents(s.priceCents)}${s.billing === "monthly" ? "/mo" : ""}`}
                      selected={serviceId === s.id}
                      onPress={() => {
                        setServiceId(s.id);
                        setPrice(String(s.priceCents / 100));
                        if (s.durationMinutes) setDuration(s.durationMinutes);
                      }}
                    />
                  ))}
              </View>
            ))}
            {errors.serviceId ? <Text style={styles.error}>{errors.serviceId}</Text> : null}
            <Field
              label="Price ($)"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              error={errors.priceCents}
              hint="Starts at the package price; change it to what you quoted."
            />
          </Card>

          <Card style={styles.gap}>
            <Text variant="label">When (Eastern time)</Text>
            <View style={styles.pickers}>
              <DateTimePicker value={when} mode="date" display={Platform.OS === "ios" ? "compact" : "default"} themeVariant="dark" accentColor={colors.accent} minimumDate={new Date()} onChange={(_, d) => d && setWhen((w) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), w.getHours(), w.getMinutes()))} />
              <DateTimePicker value={when} mode="time" minuteInterval={15} display={Platform.OS === "ios" ? "compact" : "default"} themeVariant="dark" accentColor={colors.accent} onChange={(_, d) => d && setWhen((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate(), d.getHours(), d.getMinutes()))} />
            </View>
            <Text variant="label">How long</Text>
            <View style={styles.wrap}>
              {DURATIONS.map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: minutes === m }}
                  onPress={() => setDuration(m)}
                  style={[styles.chip, minutes === m && styles.choiceOn]}
                >
                  <Text variant={minutes === m ? "bodyStrong" : "body"}>{durationLabel(m)}</Text>
                </Pressable>
              ))}
            </View>
            <Text variant="caption">
              Keeps {options.data.travelBufferMinutes} minutes free after the job for travel. Working hours {options.data.workHours.start}–{options.data.workHours.end}.
            </Text>
          </Card>

          <Card style={styles.gap}>
            <Field label="Notes (only you see these)" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Email a confirmation</Text>
                <Text variant="caption">Sent from your business email with the service, time, address and price.</Text>
              </View>
              <Switch value={sendConfirmation} onValueChange={setSendConfirmation} trackColor={{ true: colors.accent }} accessibilityLabel="Email a confirmation" />
            </View>
          </Card>

          <Button
            label={customerName ? `Book ${customerName}` : "Book appointment"}
            haptic="medium"
            loading={create.isPending}
            onPress={() => submit(false)}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  gap: { gap: space.md },
  row2: { flexDirection: "row", gap: space.sm },
  zip: { width: 96 },
  choice: {
    minHeight: MIN_TOUCH + 8,
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  choiceOn: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  pickers: { flexDirection: "row", gap: space.md, alignItems: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: MIN_TOUCH,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  error: { color: colors.error },
});
