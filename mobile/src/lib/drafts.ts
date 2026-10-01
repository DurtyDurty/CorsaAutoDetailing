import { create } from "zustand";
import { randomUUID } from "expo-crypto";

export interface Draft {
  subject: string;
  message: string;
  /** Identifies this draft to the server; it's sent at most once. */
  sendKey: string;
}

interface DraftState {
  drafts: Record<string, Draft>;
  save: (leadId: string, draft: Draft) => void;
  remove: (leadId: string) => void;
}

/**
 * Unsent emails, per customer, kept while the app is open (switching screens
 * or tabs doesn't lose them). Held in memory only: drafts can contain
 * customer details, and nothing is written to disk. Cleared on sign-out.
 */
export const useDrafts = create<DraftState>((set) => ({
  drafts: {},
  save: (leadId, draft) => set((s) => ({ drafts: { ...s.drafts, [leadId]: draft } })),
  remove: (leadId) =>
    set((s) => {
      const { [leadId]: _removed, ...rest } = s.drafts;
      return { drafts: rest };
    }),
}));

/** The saved draft for this customer, or a fresh one. Read once when the screen opens. */
export function initialDraft(leadId: string, fresh: () => Omit<Draft, "sendKey">): Draft {
  return useDrafts.getState().drafts[leadId] ?? { ...fresh(), sendKey: randomUUID() };
}

export const newSendKey = () => randomUUID();
export const clearAllDrafts = () => useDrafts.setState({ drafts: {} });
