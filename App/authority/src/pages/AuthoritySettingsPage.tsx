export default function AuthoritySettingsPage() {
  return (
    <div className="ops-dashboard" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem 0 3rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '1.5rem' }}>Settings</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Profile */}
          <section className="ops-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '0.25rem' }}>Profile</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--ops-text-muted)', marginBottom: '1.25rem' }}>Manage your account details and credentials.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Name</label>
                <input type="text" className="ops-input" defaultValue="Municipal Ops Admin" />
              </div>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Email</label>
                <input type="email" className="ops-input" defaultValue="admin@sadaksathi.gov" />
              </div>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Role</label>
                <input type="text" className="ops-input" defaultValue="System Administrator" disabled />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="ops-btn ops-btn--secondary">Change Password</button>
              </div>
            </div>
          </section>

          {/* Notification Settings */}
          <section className="ops-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '0.25rem' }}>Notification Settings</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--ops-text-muted)', marginBottom: '1.25rem' }}>Control how and when you receive alerts.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)' }}>
                <input type="checkbox" defaultChecked /> Email alerts for severe reports
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)' }}>
                <input type="checkbox" defaultChecked /> Report status updates
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)' }}>
                <input type="checkbox" defaultChecked /> Work order notifications
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)' }}>
                <input type="checkbox" defaultChecked /> SLA breach warnings
              </label>
            </div>
          </section>

          {/* Routing Settings */}
          <section className="ops-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '0.25rem' }}>Routing Settings</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--ops-text-muted)', marginBottom: '1.25rem' }}>Configure how reports are automatically processed and assigned.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Default Ward Assignment</label>
                <select className="ops-select" style={{ width: '100%' }}>
                  <option>Auto-assign by Coordinates</option>
                  <option>Manual Verification Required</option>
                </select>
              </div>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Priority Thresholds</label>
                <select className="ops-select" style={{ width: '100%' }}>
                  <option>AI Confidence &gt; 80% = High</option>
                  <option>Manual Priority Only</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)' }}>
                  <input type="checkbox" defaultChecked /> Enable auto-routing rules
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)', marginTop: '0.5rem' }}>
                  <input type="checkbox" defaultChecked /> Enable automatic escalation for overdue items
                </label>
              </div>
            </div>
          </section>

          {/* Status Settings */}
          <section className="ops-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '0.25rem' }}>Status Settings</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--ops-text-muted)', marginBottom: '1.25rem' }}>Manage the taxonomy of report and work order statuses.</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="ops-btn ops-btn--secondary">Configure Report Statuses</button>
              <button type="button" className="ops-btn ops-btn--secondary">Configure Work Order Statuses</button>
            </div>
          </section>

          {/* Appearance */}
          <section className="ops-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '0.25rem' }}>Appearance</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--ops-text-muted)', marginBottom: '1.25rem' }}>Customize the look and feel of your dashboard.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Theme</label>
                <select className="ops-select" style={{ width: '250px' }}>
                  <option>System Default</option>
                  <option>Light Mode</option>
                  <option>Dark Mode</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)' }}>
                  <input type="checkbox" defaultChecked /> Collapse sidebar by default
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--ops-text)', marginTop: '0.5rem' }}>
                  <input type="checkbox" /> Enable compact table mode
                </label>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="ops-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '0.25rem' }}>Security</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--ops-text-muted)', marginBottom: '1.25rem' }}>Protect your account and system access.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Session Timeout</label>
                <select className="ops-select" style={{ width: '250px' }}>
                  <option>15 Minutes</option>
                  <option>30 Minutes</option>
                  <option>1 Hour</option>
                  <option>Never</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="ops-btn ops-btn--primary">Enable Two-Factor Auth (2FA)</button>
                <button type="button" className="ops-btn ops-btn--secondary">Manage Access Control</button>
              </div>
            </div>
          </section>

          {/* Data / Privacy */}
          <section className="ops-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ops-text)', marginBottom: '0.25rem' }}>Data & Privacy</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--ops-text-muted)', marginBottom: '1.25rem' }}>Manage data retention and compliance.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label className="ops-detail-dl dt" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ops-text-muted)' }}>Retention Period</label>
                <select className="ops-select" style={{ width: '250px' }}>
                  <option>1 Year</option>
                  <option>3 Years</option>
                  <option>5 Years</option>
                  <option>Indefinite</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="ops-btn ops-btn--secondary">Export Data (CSV)</button>
                <button type="button" className="ops-btn ops-btn--secondary">View Audit Log</button>
                <button type="button" className="ops-btn ops-btn--ghost" style={{ color: '#ef4444' }}>Delete Old Data</button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
