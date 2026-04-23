import { useCivic } from '../context/CivicContext';

export default function NotificationsPage() {
  const { notifications, markAllNotificationsRead, profile, setProfile, refreshNotifications } = useCivic();

  // Normalize notifications to handle both local and server formats
  const normalizedNotifications = notifications.map((n: any) => {
    // Check if it's a server notification (has created_at_ms and message)
    if (n.created_at_ms && n.message) {
      return {
        id: n.id,
        title: n.title,
        body: n.message,
        ts: n.created_at_ms,
        read: n.read,
        reportId: n.report_id,
      };
    }
    return { id: n.id, title: n.title, body: n.body, ts: n.ts, read: n.read, reportId: n.reportId };
  });

  // Sort by timestamp descending (newest first)
  const sortedNotifications = [...normalizedNotifications].sort((a, b) => b.ts - a.ts);

  return (
    <>
      <section className="dash-hero">
        <h2>Notifications</h2>
        <p className="dash-hero-lead">Authority acceptance, work orders, and “need more info” surface here.</p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            type="button" 
            className="dash-link" 
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} 
            onClick={markAllNotificationsRead}
          >
            Mark all read
          </button>
          <button 
            type="button" 
            className="dash-link" 
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} 
            onClick={() => refreshNotifications()}
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Channels</h3>
        <label className="dash-check">
          <input type="checkbox" checked={profile.notifyEmail} onChange={(e) => setProfile({ notifyEmail: e.target.checked })} />
          Email
        </label>
        <label className="dash-check">
          <input type="checkbox" checked={profile.notifyPush} onChange={(e) => setProfile({ notifyPush: e.target.checked })} />
          Push (when PWA enabled)
        </label>
        <label className="dash-check">
          <input type="checkbox" checked={profile.notifyWhatsapp} onChange={(e) => setProfile({ notifyWhatsapp: e.target.checked })} />
          WhatsApp-style SMS (integration placeholder)
        </label>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Inbox</h3>
        {notifications.length === 0 ? (
          <p className="dash-muted">No notifications yet. Submit a report to start the lifecycle.</p>
        ) : (
          <ul className="dash-mini-list" style={{ listStyle: 'none', padding: 0 }}>
            {notifications.map((n) => (
              <li
                key={n.id}
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  opacity: n.read ? 0.65 : 1,
                }}
              >
                <strong>{n.title}</strong>
                <div className="dash-muted">{n.body}</div>
                <div className="dash-muted" style={{ fontSize: '0.72rem' }}>
                  {new Date(n.ts).toLocaleString()}
                  {n.reportId && ` · ${n.reportId}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
