import { Platform } from 'react-native';

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: 'turn_complete' | 'approval_required' | 'error' | 'info';
  timestamp: number;
}

type NotificationListener = (payload: NotificationPayload) => void;

const listeners = new Set<NotificationListener>();

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

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
    }
  }
  return true;
}

export async function scheduleNotification(options: {
  title: string;
  body: string;
  type?: 'turn_complete' | 'approval_required' | 'error' | 'info';
  data?: Record<string, any>;
}): Promise<void> {
  // 1. Web desktop notification if permitted
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

  // 2. Broadcast in-app notification banner
  emitInAppNotification({
    title: options.title,
    body: options.body,
    type: options.type || 'info',
  });
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
