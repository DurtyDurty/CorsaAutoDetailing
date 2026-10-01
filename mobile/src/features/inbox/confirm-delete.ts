import { Alert } from "react-native";

/** Ask before permanently deleting a customer's conversation and history. */
export function confirmDelete(name: string, onConfirm: () => void) {
  Alert.alert(
    `Delete ${name}?`,
    "This permanently removes their requests, emails, replies and any past appointments. It can't be undone. To just tidy your Inbox, use Archive instead.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onConfirm },
    ],
  );
}
