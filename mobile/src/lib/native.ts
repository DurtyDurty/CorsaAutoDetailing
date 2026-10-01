import { Alert, Linking, Platform } from "react-native";

async function open(url: string, failure: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open", failure);
  }
}

const digits = (phone: string) => phone.replace(/[^\d+]/g, "");

export const callPhone = (phone: string) => open(`tel:${digits(phone)}`, "This device can't place calls.");
export const textPhone = (phone: string) => open(`sms:${digits(phone)}`, "This device can't send text messages.");
export const sendEmail = (email: string) => open(`mailto:${email}`, "No email app is set up on this device.");

/** Opens turn-by-turn directions in Apple Maps (iPhone) or Google Maps (Android). */
export function navigateTo(address: string) {
  const q = encodeURIComponent(address);
  const url = Platform.OS === "ios" ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  return open(url, "Couldn't open maps for this address.");
}