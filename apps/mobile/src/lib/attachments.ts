import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i] || 'MB'}`;
}

export function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'json':
      return 'application/json';
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rs':
    case 'go':
    case 'c':
    case 'cpp':
    case 'h':
    case 'java':
    case 'kt':
    case 'swift':
    case 'css':
    case 'html':
    case 'md':
    case 'txt':
    case 'sh':
    case 'yaml':
    case 'yml':
    case 'sql':
      return 'text/plain';
    case 'zip':
      return 'application/zip';
    case 'tar':
    case 'gz':
      return 'application/gzip';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Reads a local file URI (from image picker or document picker) as a base64 string.
 * Supports React Native iOS/Android as well as Web.
 */
export async function readUriAsBase64(uri: string): Promise<string> {
  // If it's already a data URL
  if (uri.startsWith('data:')) {
    const commaIdx = uri.indexOf(',');
    return commaIdx >= 0 ? uri.slice(commaIdx + 1) : uri;
  }

  // On native platforms, prefer expo-file-system
  if (Platform.OS !== 'web') {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch {
      // Fall through to fetch + reader
    }
  }

  // Fallback for web or content:// URIs
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file as base64'));
    reader.readAsDataURL(blob);
  });
}
