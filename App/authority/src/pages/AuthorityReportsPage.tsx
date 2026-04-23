import { useEffect, useState, useMemo } from 'react';
import { fetchAuthorityCases, fetchAuthoritySummary } from '../api/authorityApi';
import type { OpsCase, AuthoritySummary } from '../opsTypes';
import { formatStatusLabel, statusBadgeClass } from '../mockOpsData';

const emptySummary: AuthoritySummary = {
  newReports: 0,
  highPriority: 0,
  inProgress: 0,
  resolvedToday: 0,
  overdue: 0,
  avgResponseHours: 0,
  slaAlerts: 0,
};

export default function AuthorityReportsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cases, setCases] = useState<OpsCase[]>([]);
  const [summary, setSummary] = useState<AuthoritySummary>(emptySummary);

  useEffect(() => {
    const load = async () => {
      try {
        const [listRes, sumRes] = await Promise.all([fetchAuthorityCases(), fetchAuthoritySummary()]);
        setCases(listRes.cases);
        setSummary(sumRes);
      } catch (e) {
        console.error(e);
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(t);
  }, []);
  
  const dummyReports = cases;

  return (
    <div className="ops-dashboard">
      <section className="ops-kpi-row" aria-label="Summary">
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">New reports</span>
          <span className="ops-kpi-value">{summary.newReports}</span>
          <div className="ops-kpi-inline" style={{ marginTop: 'auto' }}>
            <span className="ops-kpi-inline-label">SLA alerts:</span>
            <span className={`ops-kpi-inline-value ${summary.slaAlerts > 0 ? 'ops-kpi-value--alert' : ''}`}>{summary.slaAlerts}</span>
          </div>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">High priority</span>
          <span className="ops-kpi-value ops-kpi-value--alert">{summary.highPriority}</span>
          <div className="ops-kpi-inline" style={{ marginTop: 'auto' }}>
            <span className="ops-kpi-inline-label">Overdue:</span>
            <span className={`ops-kpi-inline-value ${summary.overdue > 0 ? 'ops-kpi-value--warn' : ''}`}>{summary.overdue}</span>
          </div>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">In progress</span>
          <span className="ops-kpi-value ops-kpi-value--warn">{summary.inProgress}</span>
          <div className="ops-kpi-inline" style={{ marginTop: 'auto' }}>
            <span className="ops-kpi-inline-label">Avg response:</span>
            <span className="ops-kpi-inline-value">{summary.avgResponseHours}h</span>
          </div>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Resolved today</span>
          <span className="ops-kpi-value ops-kpi-value--ok">{summary.resolvedToday}</span>
        </article>
      </section>

      <div className="ops-workspace">
        <div className="ops-workspace-main">
          <div className="ops-card ops-card--table" style={{ minHeight: '600px' }}>
            <div className="ops-card-head">
              <h2 className="ops-card-title">Report Queue</h2>
              <div className="ops-table-filters">
                <input type="text" className="ops-input" placeholder="Search ID or Road..." style={{ width: '200px' }} />
                <select className="ops-select" aria-label="Ward">
                  <option>All wards</option>
                  <option>Ward 05</option>
                  <option>Ward 08</option>
                  <option>Ward 12</option>
                </select>
                <select className="ops-select" aria-label="Status">
                  <option>All status</option>
                  <option>New</option>
                  <option>In Progress</option>
                  <option>Resolved</option>
                </select>
                <select className="ops-select" aria-label="Severity">
                  <option>All severity</option>
                  <option>Severe</option>
                  <option>Moderate</option>
                  <option>Minor</option>
                </select>
              </div>
            </div>
            <div className="ops-table-scroll">
              <table className="ops-data-table">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Location</th>
                    <th>Issue type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Time received</th>
                  </tr>
                </thead>
                <tbody>
                  {dummyReports.map((r) => (
                    <tr 
                      key={r.id} 
                      className={selectedId === r.id ? 'is-selected' : ''}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="ops-cell-mono">{r.id}</td>
                      <td>{r.ward}, {r.zone}</td>
                      <td>{r.issueType}</td>
                      <td>
                        <span className={`ops-sev-pill ops-sev-pill--${r.severity}`}>{r.severity}</span>
                      </td>
                      <td>
                        <span className={statusBadgeClass(r.status)}>
                          {formatStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="ops-cell-time">{new Date(r.submittedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="ops-detail" aria-label="Report detail">
          {selectedId ? (
            <div className="ops-detail-inner">
              <div className="ops-detail-top">
                <h2 className="ops-detail-id">{selectedId}</h2>
                <button type="button" className="ops-detail-close" onClick={() => setSelectedId(null)} aria-label="Close detail">×</button>
              </div>
              <div className="ops-detail-photo" style={{ background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#64748b' }}>Photo Placeholder</span>
              </div>
              <dl className="ops-detail-dl">
                <div><dt>Location</dt><dd>19.87842, 74.48211<br/>Ward 05 · North · Arterial</dd></div>
                <div><dt>Issue type</dt><dd>Deep Pothole</dd></div>
                <div><dt>Severity</dt><dd>Severe</dd></div>
                <div><dt>AI confidence</dt><dd>89.4%</dd></div>
                <div><dt>Description</dt><dd>Large crater in the middle lane causing traffic slowdowns.</dd></div>
                <div><dt>Time received</dt><dd>Today at 10:45 AM</dd></div>
                <div><dt>Assigned team</dt><dd>Team Alpha (North)</dd></div>
                <div><dt>Status</dt><dd><span className="ops-badge ops-badge--info">New</span></dd></div>
              </dl>
              <div className="ops-detail-actions">
                <button type="button" className="ops-btn ops-btn--secondary">Verify</button>
                <button type="button" className="ops-btn ops-btn--secondary">Assign</button>
                <button type="button" className="ops-btn ops-btn--amber">Mark in progress</button>
                <button type="button" className="ops-btn ops-btn--success">Mark resolved</button>
                <button type="button" className="ops-btn ops-btn--ghost">Reject</button>
              </div>
            </div>
          ) : (
            <div className="ops-detail-empty">
              <p>Select a report in the table to review details and take action.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
