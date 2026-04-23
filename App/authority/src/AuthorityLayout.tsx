import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { fetchAuthorityMeta } from './api/authorityApi';
import './authority.css';
import type { WardFilterContext } from './authorityTypes';

const mainNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/reports', label: 'Reports', end: false },
  { to: '/map', label: 'Map view', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

const DEFAULT_WARDS = ['All wards', 'Ward 05', 'Ward 08', 'Ward 12'];
const DEFAULT_ZONES = ['All zones', 'North', 'East', 'Central'];

export default function AuthorityLayout() {
  const [wardFilter, setWardFilter] = useState('All wards');
  const [wardOptions, setWardOptions] = useState(DEFAULT_WARDS);
  const [zoneOptions, setZoneOptions] = useState(DEFAULT_ZONES);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAuthorityMeta()
      .then((m) => {
        if (cancelled) return;
        setWardOptions(['All wards', ...m.wards]);
        setZoneOptions(['All zones', ...m.zones]);
      })
      .catch(() => {
        /* keep defaults */
      });
    const t = window.setInterval(() => {
      void fetchAuthorityMeta()
        .then((m) => {
          setWardOptions(['All wards', ...m.wards]);
          setZoneOptions(['All zones', ...m.zones]);
        })
        .catch(() => {});
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const outletCtx: WardFilterContext = {
    wardFilter,
    setWardFilter,
    wardOptions,
    zoneOptions,
  };

  return (
    <div className={`ops-shell${mobileNavOpen ? ' ops-shell--nav-open' : ''}`}>
      <button
        type="button"
        className="ops-mobile-nav-toggle"
        aria-label="Open menu"
        onClick={() => setMobileNavOpen(true)}
      >
        Menu
      </button>
      {mobileNavOpen && (
        <button type="button" className="ops-backdrop" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside className="ops-sidebar" aria-label="Operations navigation">
        <div className="ops-brand">
          <span className="ops-brand-mark" aria-hidden />
          <div>
            <div className="ops-brand-title">Municipal Ops</div>
            <div className="ops-brand-sub">Road damage</div>
          </div>
        </div>

        <nav className="ops-nav" aria-label="Primary">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `ops-nav-link${isActive ? ' active' : ''}`}
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="ops-body">
        <header className="ops-topbar">
          <div className="ops-topbar-search">
            <label htmlFor="ops-global-search" className="ops-sr-only">
              Search reports
            </label>
            <input
              id="ops-global-search"
              type="search"
              className="ops-input ops-input--search"
              placeholder="Search report ID, road, or ward…"
              autoComplete="off"
            />
          </div>
          <div className="ops-topbar-filters">
            <label htmlFor="ops-top-ward" className="ops-sr-only">
              Ward / zone
            </label>
            <select
              id="ops-top-ward"
              className="ops-select ops-select--compact"
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
            >
              {wardOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div className="ops-topbar-actions">
            <button type="button" className="ops-icon-btn" aria-label="Notifications">
              <span className="ops-bell" aria-hidden />
              <span className="ops-notif-dot" />
            </button>
            <div className="ops-user" title="Signed in (demo)">
              <span className="ops-user-avatar">MO</span>
            </div>
          </div>
        </header>

        <main className="ops-outlet">
          <Outlet context={outletCtx} />
        </main>
      </div>
    </div>
  );
}
