import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';

export default function MyReportsPage() {
  const [params] = useSearchParams();
  const highlight = params.get('id');
  const { remoteReports, refreshRemoteReports } = useCivic();

  const sorted = useMemo(
    () => [...remoteReports].sort((a, b) => b.created_at_ms - a.created_at_ms),
    [remoteReports],
  );

  return (
    <>
      <section className="dash-hero">
        <h2>My reports</h2>
        <p className="dash-hero-lead">Track routing, authority acceptance, and resolution. IDs are scoped to this device.</p>
        <button type="button" className="dash-link" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => void refreshRemoteReports()}>
          Sync now
        </button>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">All synced reports</h3>
        {sorted.length === 0 ? (
          <p className="dash-muted">No reports yet.</p>
        ) : (
          <div className="dash-only-desktop">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Issue</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} style={highlight === r.id ? { background: 'rgba(192, 132, 252, 0.08)' } : undefined}>
                    <td>{r.id}</td>
                    <td>{new Date(r.created_at_ms).toLocaleDateString()}</td>
                    <td>{r.location_summary}</td>
                    <td>{r.issue_type}</td>
                    <td>{r.severity}</td>
                    <td>{r.lifecycle?.headline ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="dash-only-mobile dash-stack">
          {sorted.map((r) => (
            <article key={r.id} className="dash-report-card">
              <header>
                <strong>{r.id}</strong>
                <span className="dash-chip">{r.lifecycle?.phase ?? 'submitted'}</span>
              </header>
              <div className="dash-muted">
                {new Date(r.created_at_ms).toLocaleString()} · {r.location_summary}
              </div>
              <div className="dash-muted">
                {r.issue_type} · {r.severity} · {r.routed_to}
              </div>
              <div className="dash-muted">
                Authority accepted: {r.lifecycle?.authority_accepted ? 'Yes (demo timeline)' : 'Pending'} · Resolved:{' '}
                {r.lifecycle?.resolved ? 'Yes (demo)' : 'No'}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
