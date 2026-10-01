import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ConversationDetail, ConversationMessage } from "@shared/api";
import { formatCents } from "@shared/money";
import { availableTemplates, type EmailTemplate } from "@shared/templates";
import { ApiClientError } from "@/api/client";
import { useConversation, useMarkHandled, useMe, useSendMessage } from "@/api/queries";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Field } from "@/design/Field";
import { Skeleton } from "@/design/Skeleton";
import { ErrorState } from "@/design/States";
import { Text } from "@/design/Text";
import { colors, space } from "@/design/theme";
import { initialDraft, newSendKey, useDrafts, type Draft } from "@/lib/drafts";
import { formatShortDay, formatTime, formatWhen } from "@/lib/format";
import { callPhone, textPhone } from "@/lib/native";

const longDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });

function Message({ m }: { m: ConversationMessage }) {
  if (m.type === "website") {
    return (
      <Card style={styles.msg}>
        <Text variant="label">
          {m.title} · {formatWhen(m.at)}
        </Text>
        {m.text ? <Text variant="body">{m.text}</Text> : null}
      </Card>
    );
  }
  const failed = m.status === "failed";
  return (
    <View style={[styles.sent, failed && styles.sentFailed]} accessible accessibilityLabel={`${failed ? "Not sent" : "You sent"}: ${m.subject}`}>
      <Text variant="label" style={failed ? styles.failedText : undefined}>
        {failed ? "! Not sent" : "You"} · {formatShortDay(m.at)} {formatTime(m.at)}
      </Text>
      <Text variant="bodyStrong">{m.subject}</Text>
      <Text variant="body">{m.body}</Text>
      {failed && m.error ? <Text style={styles.failedText}>{m.error}</Text> : null}
    </View>
  );
}

function Composer({ c, businessName }: { c: ConversationDetail; businessName: string }) {
  const fresh = () => ({ subject: c.defaultSubject, message: `Hi ${c.firstName},\n\n` });
  const [draft, setDraft] = useState<Draft>(() => initialDraft(c.leadId, fresh));
  const [picking, setPicking] = useState(false);
  const save = useDrafts((s) => s.save);
  const send = useSendMessage(c.leadId);

  // Keep the draft if you leave this screen and come back.
  useEffect(() => save(c.leadId, draft), [c.leadId, draft, save]);

  const templates = useMemo(
    () => availableTemplates({ appointment: !!c.appointment, balance: (c.appointment?.balanceDueCents ?? 0) > 0 }),
    [c.appointment],
  );

  const applyTemplate = (t: EmailTemplate) => {
    const f = {
      firstName: c.firstName,
      businessName,
      serviceName: c.serviceName,
      date: c.appointment ? longDay.format(new Date(c.appointment.startsAt)) : null,
      time: c.appointment ? formatTime(c.appointment.startsAt) : null,
      balance: c.appointment ? formatCents(c.appointment.balanceDueCents) : null,
    };
    const replace = () => setDraft((d) => ({ ...d, subject: t.subject(f), message: t.body(f) }));
    setPicking(false);
    const typed = draft.message.trim() !== fresh().message.trim();
    if (typed) {
      Alert.alert("Replace your draft?", "The template will replace what you've written.", [
        { text: "Keep mine", style: "cancel" },
        { text: "Use template", onPress: replace },
      ]);
    } else replace();
  };

  const onSend = () => {
    send.mutate(
      { subject: draft.subject.trim(), message: draft.message.trim(), sendKey: draft.sendKey },
      {
        onSuccess: (res) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setDraft({ ...fresh(), sendKey: newSendKey() });
          if (res.alreadySent) Alert.alert("Already sent", "This email had already gone out.");
        },
        onError: (err) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const offline = err instanceof ApiClientError && (err.code === "network" || err.code === "timeout");
          // Offline: keep the same key so a retry can't send twice. Otherwise the server
          // recorded a failure for this key, so the next try needs a new one.
          if (!offline) setDraft((d) => ({ ...d, sendKey: newSendKey() }));
          Alert.alert(offline ? "Not sent yet" : "Couldn't send", err.message);
        },
      },
    );
  };

  const empty = !draft.subject.trim() || draft.message.trim() === fresh().message.trim() || !draft.message.trim();
  return (
    <Card style={styles.composer}>
      <View style={styles.composerHead}>
        <Text variant="label">New email to {c.email}</Text>
        <Button label="Templates" variant="ghost" onPress={() => setPicking(true)} haptic="light" />
      </View>
      <Field label="Subject" value={draft.subject} onChangeText={(subject) => setDraft((d) => ({ ...d, subject }))} maxLength={200} />
      <Field label="Message" value={draft.message} onChangeText={(message) => setDraft((d) => ({ ...d, message }))} multiline maxLength={8000} />
      <Text variant="caption">Your signature is added automatically:{"\n"}{c.signature}</Text>
      {!c.canSend && <Text style={styles.failedText}>Email isn&apos;t set up on the server, so sending is off.</Text>}
      <Button label="Send email" haptic="medium" loading={send.isPending} disabled={empty || !c.canSend} onPress={onSend} fullWidth />

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text variant="title">Templates</Text>
            <Button label="Close" variant="ghost" onPress={() => setPicking(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.sheetList}>
            {templates.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                onPress={() => applyTemplate(t)}
                style={({ pressed }) => [styles.template, pressed && styles.pressed]}
              >
                <Text variant="bodyStrong">{t.label}</Text>
              </Pressable>
            ))}
            {!c.appointment && (
              <Text variant="caption">Confirmation, reminder and payment templates appear once this customer has an appointment.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Card>
  );
}

export default function ConversationScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const { data: c, error, isPending, refetch, isRefetching } = useConversation(leadId);
  const { data: me } = useMe();
  const handled = useMarkHandled(leadId);
  const scroll = useRef<ScrollView>(null);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: c?.customerName ?? "Conversation" }} />
      {isPending ? (
        <View style={styles.content}>
          <Skeleton height={90} />
          <Skeleton height={140} />
        </View>
      ) : !c ? (
        <ErrorState message={error?.message ?? "Couldn't load this conversation."} onRetry={() => void refetch()} retrying={isRefetching} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          >
            <View style={styles.actions}>
              {c.phone && <Button label="Call" variant="secondary" onPress={() => void callPhone(c.phone!)} style={styles.action} />}
              {c.phone && <Button label="Text" variant="secondary" onPress={() => void textPhone(c.phone!)} style={styles.action} />}
              <Button
                label="Book"
                variant="secondary"
                onPress={() => router.push({ pathname: "/appointment/new", params: { leadId: c.leadId } })}
                style={styles.action}
              />
            </View>
            {c.unread && (
              <Button label="Mark handled" variant="ghost" loading={handled.isPending} onPress={() => handled.mutate()} />
            )}
            {c.messages.map((m) => (
              <Message key={m.id} m={m} />
            ))}
            <Composer c={c} businessName={me?.business.name ?? "Corsa Auto Detailing"} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
  msg: { gap: space.sm },
  sent: {
    gap: space.xs,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    padding: space.lg,
    marginLeft: space.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sentFailed: { borderColor: colors.error },
  failedText: { color: colors.error },
  composer: { gap: space.md, marginTop: space.md },
  composerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: space.lg },
  sheetList: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xxl },
  template: { padding: space.lg, backgroundColor: colors.surface, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pressed: { opacity: 0.6 },
});
