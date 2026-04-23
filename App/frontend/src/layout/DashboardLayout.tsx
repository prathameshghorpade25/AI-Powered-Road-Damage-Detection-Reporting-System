import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';
import './dashboard.css';

const AUTHORITY_ORIGIN = import.meta.env.VITE_AUTHORITY_ORIGIN ?? 'http://localhost:5174';

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/ai-composer', label: 'AI Composer' },
  { to: '/report', label: 'Report issue' },
  { to: '/reports', label: 'My reports' },
  { to: '/settings', label: 'Settings' },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const {
    searchQuery,
    setSearchQuery,
    unreadCount,
    profile,
    syncStatus,
    remoteReports,
    refreshRemoteReports,
    refreshNotifications,
    logoutLocal,
  } = useCivic();
  const loc = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
  }, []);

  useEffect(() => {
    const closeMenus = () => {
      setSidebarOpen(false);
      setAccountOpen(false);
    };

    closeMenus();
  }, [loc.pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!accountOpen) return;
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [accountOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    void refreshRemoteReports();
  }, [refreshRemoteReports]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const filteredIds = remoteReports.filter((r) => {
    if (!searchQuery.trim()) return false;
    return r.id.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  return (
    <div className="dash-shell">
      <header className="dash-topbar dash-only-mobile-flex">
        <button
          type="button"
          className="dash-icon-btn dash-sr-mobile"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <div className="dash-header-brand">
          <img src="/SadakSathi%20AI.png" alt="SadakSathi AI Logo" className="dash-logo-mini" style={{ borderRadius: '50%' }} />
          <span className="dash-header-title">SadakSathi AI</span>
        </div>
        <div className="dash-topbar-right">
          <span className={`dash-sync dash-sync-${syncStatus}`} title="Connection">
            {syncStatus === 'offline' ? 'Offline' : syncStatus === 'syncing' ? 'Syncing' : 'Online'}
          </span>
        </div>
      </header>

      <div className={`dash-backdrop${sidebarOpen ? ' open' : ''}`} aria-hidden onClick={() => setSidebarOpen(false)} />

      <div className="dash-grid">
        <aside className={`dash-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="dash-side-top" style={{ justifyContent: 'center', marginBottom: '1rem', marginTop: '0.5rem' }}>
            <div className="dash-header-brand dash-only-desktop-flex">
              <img src="/SadakSathi%20AI.png" alt="SadakSathi AI Logo" className="dash-logo-mini" style={{ borderRadius: '50%' }} />
              <span className="dash-header-title">SadakSathi AI</span>
            </div>
            <button
              type="button"
              className="dash-close-side dash-only-mobile-block"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>

          <div className="dash-search-wrap" style={{ margin: '0.5rem 0 1.5rem' }}>
            <label className="dash-sr-only" htmlFor="dash-search">
              Search report ID
            </label>
            <input
              id="dash-search"
              className="dash-search"
              placeholder="Search report ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim() && filteredIds.length > 0 && (
              <ul className="dash-search-hint">
                {filteredIds.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <NavLink to={`/reports?id=${encodeURIComponent(r.id)}`}>{r.id}</NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <nav className="dash-side-nav" aria-label="Sidebar">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `dash-nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}

          </nav>
          
          <div className="dash-side-footer" ref={accountRef}>
            <a className="dash-nav-link muted" href="#help">
              Help
            </a>

            <div style={{ marginTop: '0.5rem', position: 'relative' }}>
              <button
                type="button"
                className="dash-avatar-btn"
                aria-label="Account and system status"
                aria-expanded={accountOpen}
                aria-haspopup="true"
                title={profile.displayName || 'Citizen'}
                onClick={() => setAccountOpen((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.5rem', textAlign: 'left', borderRadius: '0.5rem', background: 'rgba(148, 163, 184, 0.08)' }}
              >
                <span className="dash-avatar" style={{ width: '2rem', height: '2rem', flexShrink: 0 }}>
                  {(profile.displayName || 'Citizen').slice(0, 1).toUpperCase()}
                </span>
                <span className="dash-profile-name" style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--dash-text)' }}>
                  {profile.displayName || 'Citizen'}
                </span>
              </button>
              {accountOpen && (
                <div className="dash-account-dropdown" role="region" aria-label="Account panel">
                  <section className="dash-card">
                    <h3 className="dash-card-title">Profile</h3>
                    <div className="dash-profile-row">
                      <div className="dash-avatar lg">{(profile.displayName || 'Citizen').slice(0, 1).toUpperCase()}</div>
                      <div>
                        <div className="dash-profile-name">{profile.displayName || 'Citizen'}</div>
                        <div className="dash-profile-meta">
                          {profile.emailVerified ? 'Email verified' : 'Email not verified'} ·{' '}
                          {profile.phoneVerified ? 'Phone verified' : 'Phone not verified'}
                        </div>
                      </div>
                    </div>
                    <p className="dash-mini">Language: {profile.language === 'en' ? 'English' : 'हिंदी'}</p>
                    <p className="dash-mini">Alerts: {['email', profile.notifyPush && 'push', profile.notifyWhatsapp && 'WhatsApp'].filter(Boolean).join(', ') || '—'}</p>
                    {profile.homeArea && <p className="dash-mini">Home area: {profile.homeArea}</p>}
                    <NavLink to="/places" className="dash-link" onClick={() => setAccountOpen(false)}>
                      Saved places
                    </NavLink>
                    <NavLink to="/settings" className="dash-link" onClick={() => setAccountOpen(false)}>
                      Edit profile
                    </NavLink>
                  </section>

                  <section className="dash-card">
                    <h3 className="dash-card-title">Privacy</h3>
                    <NavLink to="/privacy" className="dash-link" onClick={() => setAccountOpen(false)}>
                      Consent & data controls
                    </NavLink>
                  </section>
                  
                  <section className="dash-card" style={{ border: 'none', padding: '0', background: 'transparent' }}>
                    <button
                      type="button"
                      className="dash-nav-link muted dash-btn-link"
                      style={{ margin: 0, padding: '0.85rem 1rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 'bold' }}
                      onClick={() => {
                        if (confirm('Sign out on this device? Local profile data will be cleared.')) {
                          logoutLocal();
                          setAccountOpen(false);
                        }
                      }}
                    >
                      Log out
                    </button>
                  </section>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="dash-main">
          <div className="dash-main-inner">
            <Outlet />
          </div>
        </main>
      </div>

      <NavLink to="/notifications" className="dash-bell dash-bell-floating" aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="dash-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </NavLink>


    </div>
  );
}
