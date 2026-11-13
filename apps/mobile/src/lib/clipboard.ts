import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

/**
 * Universal clipboard utility that writes plain text to system clipboard
 * across Web, iOS, and Android.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    await Clipboard.setStringAsync(text);
    return true;
  } catch (err) {
    console.warn('[Clipboard] Failed to copy text to clipboard:', err);
    return false;
  }
}
