import { Platform } from 'react-native';
import { isRunningInExpoGo } from './notifications';

export interface DictationCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

let activeWebRecognition: any = null;
let activeNativeModule: any = null;
let activeNativeSubscriptions: Array<{ remove: () => void }> = [];

/**
 * Checks whether speech recognition is available in the current environment.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  if (isRunningInExpoGo()) {
    return false;
  }

  try {
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
    return Boolean(ExpoSpeechRecognitionModule);
  } catch {
    return false;
  }
}

/**
 * Requests speech recognition & microphone permissions.
 */
export async function requestSpeechPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return isSpeechRecognitionSupported();
  }

  if (isRunningInExpoGo()) {
    return false;
  }

  try {
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
    if (!ExpoSpeechRecognitionModule?.requestPermissionsAsync) return false;
    const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return res.status === 'granted' || res.granted === true;
  } catch (err) {
    console.warn('[Speech] Permission request failed:', err);
    return false;
  }
}

/**
 * Starts continuous or interim speech-to-text dictation.
 * Returns a teardown function that stops recording.
 */
export async function startDictation(callbacks: DictationCallbacks): Promise<() => void> {
  stopDictation();

  // 1. Web Speech API implementation
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      callbacks.onError?.('Web Speech API is unavailable in non-browser environment.');
      return () => {};
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      callbacks.onError?.('Voice dictation is not supported in this browser. Use Chrome or Safari.');
      return () => {};
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      callbacks.onStart?.();
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const text = (final || interim).trim();
      if (text) {
        callbacks.onResult(text, Boolean(final));
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error || 'Speech recognition error';
      callbacks.onError?.(err);
    };

    recognition.onend = () => {
      callbacks.onEnd?.();
      activeWebRecognition = null;
    };

    activeWebRecognition = recognition;
    recognition.start();

    return () => stopDictation();
  }

  // 2. Native Standalone / Preview APK implementation (expo-speech-recognition)
  if (isRunningInExpoGo()) {
    callbacks.onError?.('Voice dictation requires the Cloud Agent Dev/Preview APK build.');
    return () => {};
  }

  try {
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
    if (!ExpoSpeechRecognitionModule) {
      callbacks.onError?.('Native speech module unavailable.');
      return () => {};
    }

    const hasPermission = await requestSpeechPermissions();
    if (!hasPermission) {
      callbacks.onError?.('Microphone or Speech Recognition permission was denied in device settings.');
      return () => {};
    }

    activeNativeModule = ExpoSpeechRecognitionModule;

    // Clear prior subscriptions
    activeNativeSubscriptions.forEach((sub) => {
      try {
        sub.remove();
      } catch {}
    });
    activeNativeSubscriptions = [];

    // Subscribe to speech events
    if (ExpoSpeechRecognitionModule.addSpeechRecognitionListener) {
      const startSub = ExpoSpeechRecognitionModule.addSpeechRecognitionListener(
        'start',
        () => callbacks.onStart?.()
      );
      const resSub = ExpoSpeechRecognitionModule.addSpeechRecognitionListener(
        'result',
        (ev: any) => {
          const results = ev.results || [];
          if (results.length > 0) {
            const transcript = results[0]?.transcript || '';
            const isFinal = Boolean(ev.isFinal);
            if (transcript.trim()) {
              callbacks.onResult(transcript.trim(), isFinal);
            }
          }
        }
      );
      const errSub = ExpoSpeechRecognitionModule.addSpeechRecognitionListener(
        'error',
        (errEv: any) => {
          const msg = errEv.message || errEv.error || 'Speech recognition failed';
          callbacks.onError?.(msg);
        }
      );
      const endSub = ExpoSpeechRecognitionModule.addSpeechRecognitionListener(
        'end',
        () => {
          callbacks.onEnd?.();
        }
      );

      activeNativeSubscriptions.push(startSub, resSub, errSub, endSub);
    }

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
    });

    return () => stopDictation();
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.warn('[Speech] Native dictation error:', msg);
    callbacks.onError?.(`Speech error: ${msg}`);
    return () => {};
  }
}

/**
 * Stops any active speech recognition session.
 */
export function stopDictation(): void {
  // Web teardown
  if (activeWebRecognition) {
    try {
      activeWebRecognition.stop();
    } catch {}
    activeWebRecognition = null;
  }

  // Native teardown
  if (activeNativeModule) {
    try {
      activeNativeModule.stop?.();
    } catch {}
    activeNativeModule = null;
  }

  activeNativeSubscriptions.forEach((sub) => {
    try {
      sub.remove();
    } catch {}
  });
  activeNativeSubscriptions = [];
}
