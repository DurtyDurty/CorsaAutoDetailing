import Constants from "expo-constants";

interface Extra {
  apiBaseUrl?: string;
  dashboardUrl?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** The live website: the app's only backend. Set in app.json `extra`. */
export const API_BASE_URL = (extra.apiBaseUrl ?? "https://corsaautodetailing.com").replace(/\/$/, "");
export const DASHBOARD_URL = extra.dashboardUrl ?? `${API_BASE_URL}/admin`;
export const BUSINESS_TIME_ZONE = "America/New_York";