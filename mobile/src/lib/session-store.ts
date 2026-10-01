import { create } from "zustand";
import type { SessionTokens } from "@shared/api";
import { clearSession, loadSession, saveSession } from "./secure-session";

type Status = "loading" | "signedOut" | "signedIn";

interface SessionState {
  status: Status;
  session: SessionTokens | null;
  /** Read the saved session once at launch. */
  restore: () => Promise<void>;
  setSession: (s: SessionTokens) => Promise<void>;
  signOutLocally: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: "loading",
  session: null,
  restore: async () => {
    const s = await loadSession().catch(() => null);
    set({ session: s, status: s ? "signedIn" : "signedOut" });
  },
  setSession: async (s) => {
    await saveSession(s);
    set({ session: s, status: "signedIn" });
  },
  signOutLocally: async () => {
    await clearSession().catch(() => undefined);
    set({ session: null, status: "signedOut" });
  },
}));