import { useState } from 'react';

export default function AuthorityTeamsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dummyTeams: any[] = [];

  return (
    <div className="ops-dashboard">
      <section className="ops-kpi-row" aria-label="Summary">
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Total Teams</span>
          <span className="ops-kpi-value">12</span>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Active Teams</span>
          <span className="ops-kpi-value ops-kpi-value--ok">8</span>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Available Teams</span>
          <span className="ops-kpi-value">3</span>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Busy Teams</span>
          <span className="ops-kpi-value ops-kpi-value--warn">5</span>
        </article>
      </section>

      <div className="ops-workspace">
        <div className="ops-workspace-main">
          <div className="ops-card ops-card--table" style={{ minHeight: '600px' }}>
            <div className="ops-card-head">
              <h2 className="ops-card-title">Field Teams</h2>
              <div className="ops-table-filters">
                <input type="text" className="ops-input" placeholder="Search Team..." style={{ width: '200px' }} />
                <select className="ops-select">
                  <option>All Zones</option>
                  <option>North</option>
                  <option>East</option>
                  <option>Central</option>
                  <option>South</option>
                </select>
                <select className="ops-select">
                  <option>All Statuses</option>
                  <option>Available</option>
                  <option>Busy</option>
                  <option>On Route</option>
                  <option>Offline</option>
                </select>
              </div>
            </div>
            <div className="ops-table-scroll">
              <table className="ops-data-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Zone / Ward</th>
                    <th>Members</th>
                    <th>Current Workload</th>
                    <th>Status</th>
                    <th>Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {dummyTeams.map((t) => (
                    <tr 
                      key={t.id} 
                      className={selectedId === t.id ? 'is-selected' : ''}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <td style={{ fontWeight: 500 }}>{t.name}</td>
                      <td>{t.zone}</td>
                      <td>{t.members}</td>
                      <td>{t.workload}</td>
                      <td>
                        <span className={`ops-badge ${
                          t.status === 'Available' ? 'ops-badge--ok' : 
                          t.status === 'Busy' ? 'ops-badge--alert' : 
                          t.status === 'On Route' ? 'ops-badge--info' : 'ops-badge--ghost'
                        }`}>{t.status}</span>
                      </td>
                      <td className="ops-cell-time">{t.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="ops-detail" aria-label="Team detail">
          {selectedId ? (
            <div className="ops-detail-inner">
              <div className="ops-detail-top">
                <h2 className="ops-detail-id">{dummyTeams.find(t => t.id === selectedId)?.name}</h2>
                <button type="button" className="ops-detail-close" onClick={() => setSelectedId(null)} aria-label="Close detail">×</button>
              </div>
              <dl className="ops-detail-dl">
                <div><dt>Assigned Zone</dt><dd>North Zone (Ward 05, 06)</dd></div>
                <div><dt>Members</dt><dd>R. Kumar (Lead)<br/>S. Singh<br/>M. Patel<br/>A. Joshi</dd></div>
                <div><dt>Active Work Orders</dt><dd className="ops-cell-mono">WO-2026-001<br/>WO-2026-012<br/>WO-2026-044</dd></div>
                <div><dt>Last Activity</dt><dd>Updated WO-2026-001 status to 'In Progress' 10 mins ago.</dd></div>
                <div><dt>Availability Status</dt><dd><span className="ops-badge ops-badge--alert">Busy</span></dd></div>
              </dl>
              <div className="ops-detail-actions">
                <button type="button" className="ops-btn ops-btn--primary">Assign Work Order</button>
                <button type="button" className="ops-btn ops-btn--secondary">Reassign</button>
                <button type="button" className="ops-btn ops-btn--secondary">Update Availability</button>
                <button type="button" className="ops-btn ops-btn--ghost">View Assignments</button>
              </div>
            </div>
          ) : (
            <div className="ops-detail-empty">
              <p>Select a team in the table to review details and manage assignments.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
