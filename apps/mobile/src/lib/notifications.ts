import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: 'turn_complete' | 'approval_required' | 'error' | 'info';
  timestamp: number;
}

export interface PushRegistrationState {
  isSupported: boolean;
  isRegistered: boolean;
  pushToken: string | null;
  statusMessage: string;
}

type NotificationListener = (payload: NotificationPayload) => void;
const listeners = new Set<NotificationListener>();

let nativeNotifications: any = null;
let nativeDevice: any = null;
let currentPushToken: string | null = null;

/**
 * Checks if currently running inside the standard Expo Go client app.
 * In Expo Go, native push modules like expo-notifications are not registered
 * by the prebuilt binary and will crash with ExpoTopicSubscriptionModule errors.
 */
export function isRunningInExpoGo(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return true;
    if ((Constants as any).appOwnership === 'expo') return true;
    if (Boolean((Constants as any).expoGoConfig)) return true;
    if (Boolean((globalThis as any).__exponent || (globalThis as any).Expo)) return true;
  } catch {
    // fallback safe assumption
  }
  return false;
}

let registrationState: PushRegistrationState = isRunningInExpoGo()
  ? {
      isSupported: false,
      isRegistered: false,
      pushToken: null,
      statusMessage: 'Expo Go: In-app toasts active (lock-screen push requires Dev APK build)',
    }
  : {
      isSupported: false,
      isRegistered: false,
      pushToken: null,
      statusMessage: 'Initializing notification engine...',
    };

/**
 * Safely initialize native notifications ONLY when running in a real standalone
 * or development build (NOT Expo Go).
 */
function getNativeModules() {
  if (Platform.OS === 'web' || isRunningInExpoGo()) {
    return { isExpoGo: true, notifications: null, device: null };
  }

  if (nativeNotifications) {
    return { isExpoGo: false, notifications: nativeNotifications, device: nativeDevice };
  }

  try {
    nativeDevice = require('expo-device');
    nativeNotifications = require('expo-notifications');

    if (nativeNotifications && typeof nativeNotifications.setNotificationHandler === 'function') {
      nativeNotifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }

    return {
      isExpoGo: false,
      notifications: nativeNotifications,
      device: nativeDevice,
    };
  } catch (err) {
    console.warn('[Notifications] Could not load native notifications module:', err);
    return { isExpoGo: true, notifications: null, device: null };
  }
}

export function onInAppNotification(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitInAppNotification(payload: Omit<NotificationPayload, 'id' | 'timestamp'>) {
  const fullPayload: NotificationPayload = {
    ...payload,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  listeners.forEach((l) => {
    try {
      l(fullPayload);
    } catch (e) {
      console.warn('[Notifications] Error in listener:', e);
    }
  });
}

/**
 * Registers device for real native push notifications.
 * Automatically configures Android notification channels and acquires the Expo Push Token.
 */
export async function registerForPushNotificationsAsync(options?: {
  gatewayUrl?: string;
  userToken?: string;
  machineId?: string;
}): Promise<string | null> {
  if (Platform.OS === 'web') {
    registrationState = {
      isSupported: true,
      isRegistered: true,
      pushToken: 'web_desktop_notifications',
      statusMessage: 'Web desktop notifications active',
    };
    return null;
  }

  if (isRunningInExpoGo()) {
    registrationState = {
      isSupported: false,
      isRegistered: false,
      pushToken: null,
      statusMessage: 'Expo Go: In-app toasts active (lock-screen push requires Dev APK build)',
    };
    return null;
  }

  const { isExpoGo, notifications, device } = getNativeModules();

  if (isExpoGo || !notifications) {
    registrationState = {
      isSupported: false,
      isRegistered: false,
      pushToken: null,
      statusMessage: 'In-app toasts active',
    };
    return null;
  }

  try {
    // 1. Android Notification Channel configuration
    if (Platform.OS === 'android' && notifications.setNotificationChannelAsync) {
      await notifications.setNotificationChannelAsync('agent-alerts', {
        name: 'Cloud Agent Alerts',
        importance: notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0077b6',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // 2. Verify physical device
    if (device && !device.isDevice) {
      registrationState = {
        isSupported: false,
        isRegistered: false,
        pushToken: null,
        statusMessage: 'Simulator detected (Remote push requires physical device)',
      };
      return null;
    }

    // 3. Request permissions
    const { status: existingStatus } = await notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      registrationState = {
        isSupported: true,
        isRegistered: false,
        pushToken: null,
        statusMessage: 'Notification permissions denied by user',
      };
      return null;
    }

    // 4. Retrieve Expo Push Token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      'a3cb31cf-6c3f-4979-babe-45a2ea20a75e';

    const tokenResponse = await notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenResponse.data;
    currentPushToken = token;

    // 5. Register with Gateway Server if gatewayUrl is provided
    if (options?.gatewayUrl && token) {
      const cleanUrl = options.gatewayUrl.replace(/\/+$/, '');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (options.userToken) {
        headers['Authorization'] = `Bearer ${options.userToken}`;
      }

      await fetch(`${cleanUrl}/api/push/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token,
          machineId: options.machineId,
          platform: Platform.OS,
        }),
      }).catch((err) => {
        console.warn('[Notifications] Failed to sync push token with gateway:', err);
      });
    }

    registrationState = {
      isSupported: true,
      isRegistered: true,
      pushToken: token,
      statusMessage: `Registered (${token.slice(0, 16)}...)`,
    };

    return token;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Notifications] Push token registration error:', errorMsg);
    registrationState = {
      isSupported: false,
      isRegistered: false,
      pushToken: null,
      statusMessage: `Registration error: ${errorMsg}`,
    };
    return null;
  }
}

export function getPushRegistrationState(): PushRegistrationState {
  return registrationState;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
    }
    return true;
  }

  if (isRunningInExpoGo()) {
    return true;
  }

  const { notifications } = getNativeModules();
  if (notifications && typeof notifications.requestPermissionsAsync === 'function') {
    try {
      const { status } = await notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Schedules a local notification or triggers an in-app banner.
 */
export async function scheduleNotification(options: {
  title: string;
  body: string;
  type?: 'turn_complete' | 'approval_required' | 'error' | 'info';
  data?: Record<string, any>;
}): Promise<void> {
  // 1. Web desktop notification
  if (Platform.OS === 'web') {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(options.title, {
          body: options.body,
          data: options.data,
        });
      } catch (err) {
        console.warn('[Notifications] Web notification error:', err);
      }
    }
  }

  // 2. Native local notification if available (only in Dev Build/APK)
  if (!isRunningInExpoGo()) {
    const { notifications } = getNativeModules();
    if (notifications && typeof notifications.scheduleNotificationAsync === 'function') {
      try {
        await notifications.scheduleNotificationAsync({
          content: {
            title: options.title,
            body: options.body,
            data: options.data || {},
            sound: 'default',
            channelId: 'agent-alerts',
          },
          trigger: null,
        });
      } catch (err) {
        console.warn('[Notifications] Native local notification error:', err);
      }
    }
  }

  // 3. Broadcast in-app banner
  emitInAppNotification({
    title: options.title,
    body: options.body,
    type: options.type || 'info',
  });
}

/**
 * Sends a test push notification through the Gateway to verify physical device delivery.
 */
export async function triggerGatewayTestPush(gatewayUrl: string, userToken?: string): Promise<boolean> {
  try {
    const cleanUrl = gatewayUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    const res = await fetch(`${cleanUrl}/api/push/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: currentPushToken,
        title: 'Cloud Agent • Real Push Verified',
        body: 'Physical device push notification delivered successfully from Cloud Agent Gateway!',
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('[Notifications] Test push trigger failed:', err);
    return false;
  }
}

export async function notifyTurnComplete(
  sessionTitle: string,
  message: string = 'Antigravity agent completed instruction.'
) {
  await scheduleNotification({
    title: `Turn Complete • ${sessionTitle}`,
    body: message,
    type: 'turn_complete',
    data: { type: 'turn_complete' },
  });
}

export async function notifyApprovalRequired(toolName: string, command: string) {
  const shortCmd = command.length > 70 ? `${command.slice(0, 67)}...` : command;
  await scheduleNotification({
    title: 'Security Approval Required',
    body: `${toolName}: ${shortCmd}`,
    type: 'approval_required',
    data: { type: 'approval_required' },
  });
}

export async function notifyTurnError(errorMessage: string) {
  const shortMsg = errorMessage.length > 80 ? `${errorMessage.slice(0, 77)}...` : errorMessage;
  await scheduleNotification({
    title: 'Agent Execution Error',
    body: shortMsg,
    type: 'error',
    data: { type: 'error' },
  });
}
