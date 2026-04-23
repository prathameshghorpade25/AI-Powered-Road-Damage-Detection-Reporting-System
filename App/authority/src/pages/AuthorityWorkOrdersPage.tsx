import { useState } from 'react';

export default function AuthorityWorkOrdersPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dummyOrders: any[] = [];

  return (
    <div className="ops-dashboard">
      <section className="ops-kpi-row" aria-label="Summary">
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Open Work Orders</span>
          <span className="ops-kpi-value">24</span>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Assigned Today</span>
          <span className="ops-kpi-value">12</span>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">In Progress</span>
          <span className="ops-kpi-value ops-kpi-value--warn">18</span>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Completed</span>
          <span className="ops-kpi-value ops-kpi-value--ok">45</span>
        </article>
      </section>

      <div className="ops-workspace">
        <div className="ops-workspace-main">
          <div className="ops-card ops-card--table" style={{ minHeight: '600px' }}>
            <div className="ops-card-head">
              <h2 className="ops-card-title">Work Orders</h2>
              <div className="ops-table-filters">
                <input type="text" className="ops-input" placeholder="Search WO or Report ID..." style={{ width: '220px' }} />
                <select className="ops-select">
                  <option>All Priorities</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <select className="ops-select">
                  <option>All Statuses</option>
                  <option>Open</option>
                  <option>Assigned</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Delayed</option>
                </select>
              </div>
            </div>
            <div className="ops-table-scroll">
              <table className="ops-data-table">
                <thead>
                  <tr>
                    <th>Work Order ID</th>
                    <th>Report ID</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dummyOrders.map((w) => (
                    <tr 
                      key={w.id} 
                      className={selectedId === w.id ? 'is-selected' : ''}
                      onClick={() => setSelectedId(w.id)}
                    >
                      <td className="ops-cell-mono">{w.id}</td>
                      <td className="ops-cell-mono" style={{ color: '#64748b' }}>{w.reportId}</td>
                      <td>{w.location}</td>
                      <td>{w.priority}</td>
                      <td>{w.assigned}</td>
                      <td>
                        <span className={`ops-badge ${
                          w.status === 'Completed' ? 'ops-badge--ok' : 
                          w.status === 'In Progress' ? 'ops-badge--warn' : 
                          w.status === 'Delayed' ? 'ops-badge--alert' : 'ops-badge--info'
                        }`}>{w.status}</span>
                      </td>
                      <td className="ops-cell-time">{w.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="ops-detail" aria-label="Work order detail">
          {selectedId ? (
            <div className="ops-detail-inner">
              <div className="ops-detail-top">
                <h2 className="ops-detail-id">{selectedId}</h2>
                <button type="button" className="ops-detail-close" onClick={() => setSelectedId(null)} aria-label="Close detail">×</button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <div className="ops-detail-photo" style={{ flex: 1, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', marginBottom: 0 }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Before Image</span>
                </div>
                <div className="ops-detail-photo" style={{ flex: 1, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', border: '1px dashed #cbd5e1', marginBottom: 0 }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>After Image (Pending)</span>
                </div>
              </div>
              <dl className="ops-detail-dl">
                <div><dt>Linked Report</dt><dd className="ops-cell-mono">RPT-1A2B3C</dd></div>
                <div><dt>Location</dt><dd>Ward 05, Main St</dd></div>
                <div><dt>Priority</dt><dd>High</dd></div>
                <div><dt>Assigned Team</dt><dd>Team Alpha</dd></div>
                <div><dt>Due Date</dt><dd>Today, 5:00 PM</dd></div>
                <div><dt>Current Progress</dt><dd>Crew dispatched, material acquired.</dd></div>
                <div><dt>Notes</dt><dd className="ops-detail-msg">Requires hot mix asphalt. Traffic control needed.</dd></div>
              </dl>
              <div className="ops-detail-actions">
                <button type="button" className="ops-btn ops-btn--secondary">Assign Team</button>
                <button type="button" className="ops-btn ops-btn--secondary">Update Status</button>
                <button type="button" className="ops-btn ops-btn--ghost">Add Notes</button>
                <button type="button" className="ops-btn ops-btn--success">Mark Complete</button>
              </div>
            </div>
          ) : (
            <div className="ops-detail-empty">
              <p>Select a work order in the table to review details.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
