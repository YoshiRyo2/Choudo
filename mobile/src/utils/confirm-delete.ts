import { Alert, Platform } from 'react-native';

/**
 * Ask before deleting a folder or an outfit: a native alert with Cancel and a destructive
 * Delete (the web's two-tap button, done the iPhone way). The web build gets window.confirm.
 */
export function confirmDelete(name: string, onConfirm: () => void): void {
  const title = `Delete “${name}”?`;
  if (Platform.OS === 'web') {
    if (window.confirm(title)) onConfirm();
    return;
  }
  Alert.alert(title, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
