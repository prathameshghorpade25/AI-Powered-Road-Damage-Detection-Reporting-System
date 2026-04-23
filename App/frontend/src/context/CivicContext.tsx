import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listCitizenReports, submitCitizenReport, type RemoteReportRow } from '../report/reportApi';
import { fetchNotifications } from '../report/notificationApi';

import type {
  ActivityItem,
  LastScanState,
  NotificationItem,
  OfflineQueueItem,
  ProfileState,
  SavedPlace,
  SyncStatus,
} from './civicTypes';

const DEVICE_KEY = 'civic-device-id-v1';
const PROFILE_KEY = 'civic-profile-v1';
const PLACES_KEY = 'civic-saved-places-v1';
const ACTIVITY_KEY = 'civic-activity-v1';
const NOTIF_KEY = 'civic-notifications-v1';
const OFFLINE_KEY = 'civic-offline-queue-v1';
const THEME_KEY = 'civic-theme-v1';
const DRAFT_REPORT_KEY = 'pothole-citizen-report-draft-v2';

function uid() {
  return crypto.randomUUID();
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function ensureDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uid();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

const defaultProfile: ProfileState = {
  displayName: '',
  anonymousPreferred: true,
  email: '',
  phone: '',
  emailVerified: false,
  phoneVerified: false,
  language: 'en',
  notifyEmail: true,
  notifyPush: false,
  notifyWhatsapp: false,
  homeArea: '',
  imageRetentionDays: 90,
};

type CivicContextValue = {
  deviceId: string;
  profile: ProfileState;
  setProfile: (p: Partial<ProfileState>) => void;
  /** Latest captured scan file for the report wizard (not persisted). */
  lastScanImageFile: File | null;
  setLastScanImageFile: (f: File | null) => void;
  /** JPEG data URL of image with detection boxes, for report details / authority attachment. */
  lastScanResultPreview: string | null;
  setLastScanResultPreview: (u: string | null) => void;
  savedPlaces: SavedPlace[];
  addSavedPlace: (p: Omit<SavedPlace, 'id' | 'useCount'> & { id?: string }) => void;
  bumpPlaceUse: (id: string) => void;
  removePlace: (id: string) => void;
  activity: ActivityItem[];
  addActivity: (kind: string, message: string) => void;
  notifications: NotificationItem[];
  addNotification: (title: string, body: string, reportId?: string) => void;
  markAllNotificationsRead: () => void;
  offlineQueue: OfflineQueueItem[];
  enqueueOffline: (payload: string, imageDataUrl: string | null) => void;
  removeOfflineItem: (id: string) => void;
  setOfflineError: (id: string, err: string) => void;
  lastScan: LastScanState;
  setLastScan: (s: LastScanState) => void;
  remoteReports: RemoteReportRow[];
  refreshRemoteReports: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  syncStatus: SyncStatus;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  draftReportExists: boolean;
  refreshDraftFlag: () => void;
  logoutLocal: () => void;
  exportLocalDataJson: () => string;
  deleteAllLocalData: () => void;
  unreadCount: number;
};

const CivicContext = createContext<CivicContextValue | null>(null);

export function CivicProvider({ children }: { children: ReactNode }) {
  const [deviceId] = useState(() => ensureDeviceId());
  const [profile, setProfileState] = useState<ProfileState>(() => loadJson(PROFILE_KEY, defaultProfile));
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => loadJson(PLACES_KEY, []));
  const [activity, setActivity] = useState<ActivityItem[]>(() => loadJson(ACTIVITY_KEY, []));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadJson(NOTIF_KEY, []));
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    const next = loadJson<OfflineQueueItem[]>(OFFLINE_KEY, []);
    if (next.length) return next;
    const legacy = loadJson<unknown[]>('pothole-citizen-report-offline-queue', []);
    if (!legacy.length) return [];
    const migrated: OfflineQueueItem[] = legacy.map((row: unknown) => {
      const r = row as { queued_at?: number; payload?: string; imageDataUrl?: string | null };
      return {
        id: uid(),
        queued_at: r.queued_at ?? Date.now(),
        payload: r.payload ?? '{}',
        imageDataUrl: r.imageDataUrl ?? null,
      };
    });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(migrated));
    return migrated;
  });
  const [lastScan, setLastScanState] = useState<LastScanState>(null);
  const [lastScanImageFile, setLastScanImageFile] = useState<File | null>(null);
  const [lastScanResultPreview, setLastScanResultPreview] = useState<string | null>(null);
  const [remoteReports, setRemoteReports] = useState<RemoteReportRow[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('online');
  const [theme, setThemeState] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [draftReportExists, setDraftReportExists] = useState(false);

  const refreshDraftFlag = useCallback(() => {
    try {
      const d = localStorage.getItem(DRAFT_REPORT_KEY);
      if (!d) {
        setDraftReportExists(false);
        return;
      }
      const parsed = JSON.parse(d) as { step?: number };
      setDraftReportExists(typeof parsed.step === 'number' && parsed.step > 0 && parsed.step < 5);
    } catch {
      setDraftReportExists(false);
    }
  }, []);

  useEffect(() => {
    refreshDraftFlag();
  }, [refreshDraftFlag]);

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(PLACES_KEY, JSON.stringify(savedPlaces));
  }, [savedPlaces]);

  useEffect(() => {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity.slice(0, 200)));
  }, [activity]);

  useEffect(() => {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications.slice(0, 100)));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const on = () => setSyncStatus('online');
    const off = () => setSyncStatus('offline');
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setSyncStatus(navigator.onLine ? 'online' : 'offline');
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const setProfile = useCallback((p: Partial<ProfileState>) => {
    setProfileState((prev) => ({ ...prev, ...p }));
  }, []);

  const addSavedPlace = useCallback((p: Omit<SavedPlace, 'id' | 'useCount'> & { id?: string }) => {
    const place: SavedPlace = {
      id: p.id ?? uid(),
      label: p.label,
      lat: p.lat,
      lon: p.lon,
      address: p.address,
      useCount: 0,
    };
    setSavedPlaces((prev) => {
      const without = prev.filter((x) => x.label !== place.label);
      return [place, ...without].slice(0, 30);
    });
  }, []);

  const bumpPlaceUse = useCallback((id: string) => {
    setSavedPlaces((prev) =>
      prev.map((x) => (x.id === id ? { ...x, useCount: x.useCount + 1 } : x)).sort((a, b) => b.useCount - a.useCount),
    );
  }, []);

  const removePlace = useCallback((id: string) => {
    setSavedPlaces((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addActivity = useCallback((kind: string, message: string) => {
    const item: ActivityItem = { id: uid(), ts: Date.now(), kind, message };
    setActivity((prev) => [item, ...prev].slice(0, 200));
  }, []);

  const addNotification = useCallback((title: string, body: string, reportId?: string) => {
    const item: NotificationItem = { id: uid(), ts: Date.now(), title, body, read: false, reportId };
    setNotifications((prev) => [item, ...prev].slice(0, 100));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const enqueueOffline = useCallback((payload: string, imageDataUrl: string | null) => {
    const item: OfflineQueueItem = { id: uid(), queued_at: Date.now(), payload, imageDataUrl };
    setOfflineQueue((prev) => [item, ...prev]);
    addActivity('offline', 'Report queued — will retry when you are back online');
  }, [addActivity]);

  const removeOfflineItem = useCallback((id: string) => {
    setOfflineQueue((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setOfflineError = useCallback((id: string, err: string) => {
    setOfflineQueue((prev) => prev.map((x) => (x.id === id ? { ...x, lastError: err } : x)));
  }, []);

  const setLastScan = useCallback((s: LastScanState) => {
    setLastScanState(s);
  }, []);

  const refreshRemoteReports = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const { reports } = await listCitizenReports(deviceId);
      setRemoteReports(reports);
    } catch {
      addActivity('sync', 'Could not sync reports — check connection or API key');
    } finally {
      setSyncStatus(navigator.onLine ? 'online' : 'offline');
    }
  }, [deviceId, addActivity]);

  const refreshNotifications = useCallback(async () => {
    try {
      const { notifications: serverNotifications } = await fetchNotifications(deviceId);
      // Map server notifications to local format
      const mapped = serverNotifications.map((n: any) => ({
        id: n.id,
        ts: n.created_at_ms,
        title: n.title,
        body: n.message,
        read: n.read,
        reportId: n.report_id,
      }));
      const merged = [...mapped];
      // Add any local-only notifications that aren't on server
      setNotifications((prev) => {
        const serverIds = new Set(mapped.map((n: any) => n.id));
        const localOnly = prev.filter((n: any) => !serverIds.has(n.id));
        return [...merged, ...localOnly].slice(0, 100);
      });
    } catch {
      // Silently fail - notifications will be shown from local cache
    }
  }, [deviceId]);

  // Fetch notifications on mount and periodically
  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  // Automated background sync for offline queue
  useEffect(() => {
    if (syncStatus !== 'online' || offlineQueue.length === 0) return;

    let cancelled = false;
    const processQueue = async () => {
      // Process one by one to avoid overwhelming or duplicate submissions
      const item = offlineQueue[offlineQueue.length - 1]; // Oldest first (if we use push/pop) or newest? 
      // Actually the queue is prepended in enqueueOffline, so [length-1] is oldest.
      
      try {
        const payload = JSON.parse(item.payload);
        let imageFile: File | null = null;
        
        if (item.imageDataUrl) {
          const res = await fetch(item.imageDataUrl);
          const blob = await res.blob();
          imageFile = new File([blob], 'offline-evidence.jpg', { type: blob.type || 'image/jpeg' });
        }

        await submitCitizenReport(payload, imageFile);
        
        if (!cancelled) {
          removeOfflineItem(item.id);
          addActivity('sync', `Offline report ${item.id.slice(0, 8)}... synced successfully`);
          void refreshRemoteReports();
        }
      } catch (err) {
        if (!cancelled) {
          setOfflineError(item.id, (err as Error).message);
        }
      }
    };

    const timer = setTimeout(() => {
      void processQueue();
    }, 5000); // Wait 5 seconds after coming online

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [syncStatus, offlineQueue, removeOfflineItem, addActivity, refreshRemoteReports, setOfflineError]);

  const setTheme = useCallback((t: 'dark' | 'light') => setThemeState(t), []);

  const logoutLocal = useCallback(() => {
    setProfileState({ ...defaultProfile, anonymousPreferred: true });
    setNotifications([]);
    setActivity([]);
    setLastScanState(null);
    setLastScanImageFile(null);
    setLastScanResultPreview(null);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(NOTIF_KEY);
  }, []);

  const exportLocalDataJson = useCallback(() => {
    return JSON.stringify(
      {
        deviceId,
        profile,
        savedPlaces,
        activity,
        notifications,
        offlineQueue,
        remoteReports,
        exported_at: new Date().toISOString(),
      },
      null,
      2,
    );
  }, [deviceId, profile, savedPlaces, activity, notifications, offlineQueue, remoteReports]);

  const deleteAllLocalData = useCallback(() => {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PLACES_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(NOTIF_KEY);
    localStorage.removeItem(OFFLINE_KEY);
    localStorage.removeItem(DRAFT_REPORT_KEY);
    localStorage.removeItem('pothole-citizen-report-draft-v1');
    localStorage.removeItem('pothole-citizen-report-history-v1');
    setProfileState(defaultProfile);
    setSavedPlaces([]);
    setActivity([]);
    setNotifications([]);
    setOfflineQueue([]);
    setRemoteReports([]);
    setLastScanState(null);
    setLastScanImageFile(null);
    setLastScanResultPreview(null);
    refreshDraftFlag();
  }, [refreshDraftFlag]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<CivicContextValue>(
    () => ({
      deviceId,
      profile,
      setProfile,
      lastScanImageFile,
      setLastScanImageFile,
      lastScanResultPreview,
      setLastScanResultPreview,
      savedPlaces,
      addSavedPlace,
      bumpPlaceUse,
      removePlace,
      activity,
      addActivity,
      notifications,
      addNotification,
      markAllNotificationsRead,
      offlineQueue,
      enqueueOffline,
      removeOfflineItem,
      setOfflineError,
      lastScan,
      setLastScan,
      remoteReports,
      refreshRemoteReports,
      refreshNotifications,
      syncStatus,
      theme,
      setTheme,
      searchQuery,
      setSearchQuery,
      draftReportExists,
      refreshDraftFlag,
      logoutLocal,
      exportLocalDataJson,
      deleteAllLocalData,
      unreadCount,
    }),
    [
      deviceId,
      profile,
      setProfile,
      lastScanImageFile,
      lastScanResultPreview,
      savedPlaces,
      addSavedPlace,
      bumpPlaceUse,
      removePlace,
      activity,
      addActivity,
      notifications,
      addNotification,
      markAllNotificationsRead,
      offlineQueue,
      enqueueOffline,
      removeOfflineItem,
      setOfflineError,
      lastScan,
      setLastScan,
      remoteReports,
      refreshRemoteReports,
      refreshNotifications,
      syncStatus,
      theme,
      setTheme,
      searchQuery,
      draftReportExists,
      refreshDraftFlag,
      logoutLocal,
      exportLocalDataJson,
      deleteAllLocalData,
      unreadCount,
    ],
  );

  return <CivicContext.Provider value={value}>{children}</CivicContext.Provider>;
}

export function useCivic() {
  const ctx = useContext(CivicContext);
  if (!ctx) throw new Error('useCivic must be used within CivicProvider');
  return ctx;
}
