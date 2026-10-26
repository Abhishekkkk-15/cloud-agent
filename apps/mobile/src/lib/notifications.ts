import { Platform } from 'react-native';

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

// Dynamic references to native modules
let nativeNotifications: any = null;
let nativeDevice: any = null;
let nativeConstants: any = null;

let isExpoGoEnvironment = false;
let currentPushToken: string | null = null;
let registrationState: PushRegistrationState = {
  isSupported: false,
  isRegistered: false,
  pushToken: null,
  statusMessage: 'Initializing...',
};

/**
 * Safely initialize native notifications without crashing in Expo Go
 */
function getNativeModules() {
  if (Platform.OS === 'web') {
    return { isExpoGo: false, notifications: null, device: null, constants: null };
  }

  if (nativeNotifications || isExpoGoEnvironment) {
    return {
      isExpoGo: isExpoGoEnvironment,
      notifications: nativeNotifications,
      device: nativeDevice,
      constants: nativeConstants,
    };
  }

  try {
    // 1. Detect if running inside standard Expo Go client
    nativeConstants = require('expo-constants').default;
    const appOwnership = nativeConstants?.appOwnership;
    const executionEnvironment = nativeConstants?.executionEnvironment;

    // 'expo' or 'storeClient' means standard Expo Go
    if (appOwnership === 'expo' || executionEnvironment === 'storeClient') {
      isExpoGoEnvironment = true;
      console.log(
        '[Notifications] Running in Expo Go client. Native remote push requires a Development Build (EAS APK). Safe fallback active.'
      );
      registrationState = {
        isSupported: false,
        isRegistered: false,
        pushToken: null,
        statusMessage: 'Expo Go: Native push requires Development APK',
      };
      return { isExpoGo: true, notifications: null, device: null, constants: nativeConstants };
    }

    // 2. Running in Development Build, Standalone APK, or Prebuild
    nativeDevice = require('expo-device');
    nativeNotifications = require('expo-notifications');

    // Configure foreground notification handling
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
      constants: nativeConstants,
    };
  } catch (err) {
    console.warn('[Notifications] Error loading native notification modules:', err);
    isExpoGoEnvironment = true;
    registrationState = {
      isSupported: false,
      isRegistered: false,
      pushToken: null,
      statusMessage: 'Native push module not found. Using in-app toasts.',
    };
    return { isExpoGo: true, notifications: null, device: null, constants: null };
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

  const { isExpoGo, notifications, device, constants } = getNativeModules();

  if (isExpoGo || !notifications) {
    registrationState = {
      isSupported: false,
      isRegistered: false,
      pushToken: null,
      statusMessage: 'Expo Go: In-app toasts active (requires APK dev client for lock-screen push)',
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
        statusMessage: 'Simulator detected (Push requires physical device)',
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
      constants?.expoConfig?.extra?.eas?.projectId ||
      constants?.easConfig?.projectId ||
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

  // 2. Native local notification if available
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
        trigger: null, // show immediately
      });
    } catch (err) {
      console.warn('[Notifications] Native local notification error:', err);
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
