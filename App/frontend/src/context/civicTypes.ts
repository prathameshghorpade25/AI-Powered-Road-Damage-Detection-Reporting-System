export type CivicLanguage = 'en' | 'hi';

export type SyncStatus = 'online' | 'offline' | 'syncing';

export type ProfileState = {
  displayName: string;
  anonymousPreferred: boolean;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  language: CivicLanguage;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  homeArea: string;
  /** 0 = until resolved only (local policy copy), 30/90/365 */
  imageRetentionDays: number;
};

export type SavedPlace = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  address?: string;
  useCount: number;
};

export type ActivityItem = {
  id: string;
  ts: number;
  kind: string;
  message: string;
};

export type NotificationItem = {
  id: string;
  ts: number;
  title: string;
  body: string;
  read: boolean;
  reportId?: string;
};

export type LastScanState = {
  at: number;
  lat: number;
  lon: number;
  accuracyM?: number | null;
  detections: { label: string; condition: string; confidence: number }[];
  count: number;
  geocodedWard?: string;
} | null;

export type OfflineQueueItem = {
  id: string;
  queued_at: number;
  payload: string;
  imageDataUrl: string | null;
  lastError?: string;
};
