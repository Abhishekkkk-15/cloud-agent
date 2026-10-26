export interface PushNotificationMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  badge?: number;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Validates if a token is a valid Expo push token format
 */
export function isExpoPushToken(token: string): boolean {
  return typeof token === "string" && (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[") ||
    /^[a-zA-Z0-9_-]{32,}$/.test(token)
  );
}

/**
 * Sends one or more push notifications via Expo's HTTP/2 Push API.
 */
export async function sendExpoPushNotifications(
  messages: PushNotificationMessage[]
): Promise<ExpoPushTicket[]> {
  if (!messages || messages.length === 0) return [];

  // Flatten and normalize messages
  const payload: Array<{
    to: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: string;
    priority?: string;
    channelId?: string;
    badge?: number;
  }> = [];

  for (const msg of messages) {
    const recipients = Array.isArray(msg.to) ? msg.to : [msg.to];
    for (const recipient of recipients) {
      if (isExpoPushToken(recipient)) {
        payload.push({
          to: recipient,
          title: msg.title,
          body: msg.body,
          data: msg.data || {},
          sound: msg.sound === null ? undefined : "default",
          priority: msg.priority || "high",
          channelId: msg.channelId || "agent-alerts",
          badge: msg.badge,
        });
      } else {
        console.warn(`[ExpoPush] Skipping invalid push token: ${recipient}`);
      }
    }
  }

  if (payload.length === 0) {
    return [];
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ExpoPush] Server returned HTTP ${response.status}:`, errorText);
      return [{ status: "error", message: `HTTP ${response.status}: ${errorText}` }];
    }

    const json = (await response.json()) as { data?: ExpoPushTicket[]; errors?: Array<{ message: string }> };
    if (json.errors && json.errors.length > 0) {
      console.warn(`[ExpoPush] API errors:`, json.errors);
    }

    return json.data || [];
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ExpoPush] Network error sending push notification:`, errorMsg);
    return [{ status: "error", message: errorMsg }];
  }
}
