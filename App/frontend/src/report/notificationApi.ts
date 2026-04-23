import { apiUrl } from '../lib/apiBase';

const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (API_KEY) h['x-api-key'] = API_KEY;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export type NotificationItem = {
  id: string;
  report_id: string;
  device_id: string;
  type: string;
  title: string;
  message: string;
  created_at_ms: number;
  read: boolean;
};

export type NotificationListResponse = {
  notifications: NotificationItem[];
  unread_count: number;
};

export async function fetchNotifications(deviceId: string): Promise<NotificationListResponse> {
  const q = new URLSearchParams({ device_id: deviceId });
  const res = await fetch(`${apiUrl('/notifications')}?${q}`, { headers: headers(false) });
  if (!res.ok) throw new Error(`Fetch notifications failed (${res.status})`);
  return (await res.json()) as NotificationListResponse;
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem> {
  const res = await fetch(apiUrl(`/notifications/${encodeURIComponent(notificationId)}/read`), {
    method: 'POST',
    headers: headers(false),
  });
  if (!res.ok) throw new Error(`Mark read failed (${res.status})`);
  return (await res.json()) as NotificationItem;
}

export async function markAllNotificationsRead(deviceId: string): Promise<{ marked_read: number }> {
  const q = new URLSearchParams({ device_id: deviceId });
  const res = await fetch(`${apiUrl('/notifications/read-all')}?${q}`, {
    method: 'POST',
    headers: headers(false),
  });
  if (!res.ok) throw new Error(`Mark all read failed (${res.status})`);
  return (await res.json()) as { marked_read: number };
}

export async function fetchUnreadCount(deviceId: string): Promise<{ unread_count: number }> {
  const q = new URLSearchParams({ device_id: deviceId });
  const res = await fetch(`${apiUrl('/notifications/unread-count')}?${q}`, { headers: headers(false) });
  if (!res.ok) throw new Error(`Fetch unread count failed (${res.status})`);
  return (await res.json()) as { unread_count: number };
}