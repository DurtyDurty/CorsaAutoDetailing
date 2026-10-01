import type { SessionTokens } from "@shared/api";

// In-memory Keychain stand-in.
const mockKeychain = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  setItemAsync: jest.fn(async (k: string, v: string) => void mockKeychain.set(k, v)),
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  deleteItemAsync: jest.fn(async (k: string) => void mockKeychain.delete(k)),
}));
jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiBaseUrl: "https://example.test" } } }));

import { useSession } from "@/lib/session-store";
import { ApiClientError, apiRequest } from "../client";

const session = (overrides: Partial<SessionTokens> = {}): SessionTokens => ({
  accessToken: "old-access",
  refreshToken: "refresh-1",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  email: "owner@example.com",
  role: "owner",
  ...overrides,
});

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

beforeEach(async () => {
  mockKeychain.clear();
  fetchMock.mockReset();
  await useSession.getState().setSession(session());
});

describe("apiRequest", () => {
  it("sends the access token and returns the body", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { email: "owner@example.com" }));
    await expect(apiRequest("/me")).resolves.toEqual({ email: "owner@example.com" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/api/owner/v1/me");
    expect(init.headers.Authorization).toBe("Bearer old-access");
  });

  it("refreshes once on a 401 and retries with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "expired" } }))
      .mockResolvedValueOnce(json(200, session({ accessToken: "new-access", refreshToken: "refresh-2" })))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(apiRequest("/summary")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][0]).toBe("https://example.test/api/owner/v1/session/refresh");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer new-access");
    expect(useSession.getState().session?.refreshToken).toBe("refresh-2");
    expect(mockKeychain.get("corsa.session.refresh")).toBe("refresh-2");
  });

  it("shares one refresh between requests that expire together", async () => {
    await useSession.getState().setSession(session({ expiresAt: Math.floor(Date.now() / 1000) - 10 }));
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/session/refresh") ? json(200, session({ accessToken: "new-access" })) : json(200, { ok: true }),
    );
    await Promise.all([apiRequest("/summary"), apiRequest("/me"), apiRequest("/appointments")]);
    const refreshes = fetchMock.mock.calls.filter(([u]: [string]) => u.endsWith("/session/refresh"));
    expect(refreshes).toHaveLength(1);
  });

  it("signs out and wipes the mockKeychain when the session is rejected", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "expired" } }))
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "revoked" } }));
    await expect(apiRequest("/summary")).rejects.toMatchObject({ code: "unauthorized" });
    expect(useSession.getState().status).toBe("signedOut");
    expect(mockKeychain.size).toBe(0);
  });

  it("keeps the session when the network drops, and says so", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    const err = await apiRequest("/summary").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("network");
    expect(useSession.getState().status).toBe("signedIn");
  });

  it("passes the server's own error message through", async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: { code: "conflict", message: "Can't change from Completed." } }));
    await expect(apiRequest("/appointments/x/status", { method: "POST", body: {} })).rejects.toMatchObject({
      code: "conflict",
      message: "Can't change from Completed.",
    });
    expect(useSession.getState().status).toBe("signedIn");
  });

  it("refuses to call protected endpoints when signed out", async () => {
    await useSession.getState().signOutLocally();
    await expect(apiRequest("/me")).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});