import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import OpsMap from '../components/OpsMap';
import {
  fetchAuthorityCases,
  fetchAuthorityReport,
  fetchAuthoritySummary,
  fetchAuthorityTrafficHotspots,
  fetchAuthorityTrafficZones,
  patchAuthorityReport,
} from '../api/authorityApi';
import type { WardFilterContext } from '../authorityTypes';
import type { AuthoritySummary, OpsCase, TrafficHotspot, TrafficZone } from '../opsTypes';
import { formatStatusLabel, statusBadgeClass } from '../mockOpsData';

const POLL_MS = 12000;

const emptySummary: AuthoritySummary = {
  newReports: 0,
  highPriority: 0,
  inProgress: 0,
  resolvedToday: 0,
  overdue: 0,
  avgResponseHours: 0,
  slaAlerts: 0,
  highTrafficOpen: 0,
  peakHourCritical: 0,
  immediateDispatch: 0,
};

function matchesStatusFilter(c: OpsCase, statusFilter: string): boolean {
  if (statusFilter === 'all') return true;
  const st = c.status.toLowerCase();
  if (statusFilter === 'new') return ['new', 'unverified', 'routed'].includes(st);
  return st === statusFilter;
}

function trafficLabel(l?: string): string {
  if (!l) return 'Standard';
  const map: Record<string, string> = {
    low: 'Low (stable)',
    medium: 'Moderate',
    high: 'High (arterial)',
    very_high: 'Very High (congestion)',
  };
  return map[l] ?? l;
}

export default function AuthorityDashboardPage() {
  const ctx = useOutletContext<WardFilterContext | undefined>();
  const [wardLocal, setWardLocal] = useState('All wards');
  const ward = ctx?.wardFilter ?? wardLocal;
  const setWard = (w: string) => {
    ctx?.setWardFilter(w);
    setWardLocal(w);
  };

  const wardOptions = ctx?.wardOptions ?? ['All wards'];
  const zoneOptions = ctx?.zoneOptions ?? ['All zones'];

  const [cases, setCases] = useState<OpsCase[]>([]);
  const [trafficZones, setTrafficZones] = useState<TrafficZone[]>([]);
  const [trafficHotspots, setTrafficHotspots] = useState<TrafficHotspot[]>([]);
  const [summary, setSummary] = useState<AuthoritySummary>(emptySummary);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OpsCase | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [patching, setPatching] = useState(false);

  const [zone, setZone] = useState('All zones');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | OpsCase['severity']>('all');

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      const [listRes, sumRes, zoneRes, hotspotRes] = await Promise.all([
        fetchAuthorityCases(),
        fetchAuthoritySummary(),
        fetchAuthorityTrafficZones(),
        fetchAuthorityTrafficHotspots(),
      ]);
      setCases(listRes.cases);
      setSummary(sumRes);
      setTrafficZones(zoneRes.zones);
      setTrafficHotspots(hotspotRes.hotspots);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    setActionError(null);
    fetchAuthorityReport(selectedId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setLoadError((e as Error).message); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const applyStatus = async (ops_status: string) => {
    if (!selectedId) return;
    setPatching(true);
    setActionError(null);
    try {
      const updated = await patchAuthorityReport(selectedId, { ops_status });
      setDetail(updated);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setPatching(false);
    }
  };

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (ward !== 'All wards' && c.ward !== ward) return false;
      if (zone !== 'All zones' && c.zone !== zone) return false;
      if (!matchesStatusFilter(c, statusFilter)) return false;
      if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
      return true;
    });
  }, [cases, ward, zone, statusFilter, severityFilter]);

  const mapCenter = useMemo((): [number, number] => {
    if (filtered.length > 0) return [filtered[0].lat, filtered[0].lon];
    if (cases.length > 0) return [cases[0].lat, cases[0].lon];
    return [19.878, 74.48];
  }, [filtered, cases]);

  const activityLines = useMemo(() => {
    return [...cases]
      .sort((a, b) => (b.updatedAtMs ?? b.submittedAtMs ?? 0) - (a.updatedAtMs ?? a.submittedAtMs ?? 0))
      .slice(0, 5)
      .map((c) => ({
        key: c.id,
        time: new Date(c.updatedAtMs ?? c.submittedAtMs ?? Date.now()).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit',
        }),
        text: `${c.id.slice(0, 12)}… · ${formatStatusLabel(c.status)} · ${c.ward}`,
      }));
  }, [cases]);

  return (
    <div className="ops-dashboard">
      {loadError && (
        <div className="ops-banner ops-banner--error" role="alert">{loadError}</div>
      )}
      {cases.length > 0 && filtered.length === 0 && (
        <div className="ops-banner ops-banner--warn" role="status">
          {cases.length} report{cases.length === 1 ? '' : 's'} loaded from the API, but none match the current filters.
          Set the ward dropdown (top bar or Filters) to &quot;All wards&quot;, zone to &quot;All zones&quot;, and tap active severity or status chips again to clear them.
        </div>
      )}

      {/* KPI Row */}
      <section className="ops-kpi-row" aria-label="Summary">
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">New reports</span>
          <span className="ops-kpi-value">{summary.newReports}</span>
          <div className="ops-kpi-inline" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--ops-border)' }}>
            <span className="ops-kpi-inline-label">SLA alerts:</span>
            <span className={`ops-kpi-inline-value ${summary.slaAlerts > 0 ? 'ops-kpi-value--alert' : ''}`}>{summary.slaAlerts}</span>
          </div>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">High priority</span>
          <span className="ops-kpi-value ops-kpi-value--alert">{summary.highPriority}</span>
          <div className="ops-kpi-inline" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--ops-border)' }}>
            <span className="ops-kpi-inline-label">Overdue:</span>
            <span className={`ops-kpi-inline-value ${summary.overdue > 0 ? 'ops-kpi-value--warn' : ''}`}>{summary.overdue}</span>
          </div>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">In progress</span>
          <span className="ops-kpi-value ops-kpi-value--warn">{summary.inProgress}</span>
          <div className="ops-kpi-inline" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--ops-border)' }}>
            <span className="ops-kpi-inline-label">Avg response:</span>
            <span className="ops-kpi-inline-value">{summary.avgResponseHours}h</span>
          </div>
        </article>
        <article className="ops-kpi-card">
          <span className="ops-kpi-label">Resolved today</span>
          <span className="ops-kpi-value ops-kpi-value--ok">{summary.resolvedToday}</span>
          <div className="ops-kpi-inline" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--ops-border)' }}>
            <span className="ops-kpi-inline-label">Immediate dispatch:</span>
            <span className="ops-kpi-inline-value">{summary.immediateDispatch ?? 0}</span>
          </div>
        </article>
      </section>

      {/* Global Filters */}
      <div className="ops-global-filters">
        <span className="ops-global-filters-label">Filters</span>
        <select className="ops-select ops-select--compact" value={zone} onChange={(e) => setZone(e.target.value)}>
          {zoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select className="ops-select ops-select--compact" value={ward} onChange={(e) => setWard(e.target.value)}>
          {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <div className="ops-chip-row">
          {(['severe', 'moderate', 'minor'] as const).map((sev) => (
            <button key={sev} type="button"
              className={`ops-chip ops-chip--sev-${sev}${severityFilter === sev ? ' ops-chip--on' : ''}`}
              onClick={() => setSeverityFilter((prev) => (prev === sev ? 'all' : sev))}>{sev}</button>
          ))}
          <span className="ops-chip-sep" aria-hidden />
          {['new', 'in_progress', 'resolved'].map((st) => (
            <button key={st} type="button"
              className={`ops-chip${statusFilter === st ? ' ops-chip--on' : ''}`}
              onClick={() => setStatusFilter((prev) => (prev === st ? 'all' : st))}>{st.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      {/* Map + Activity — side by side */}
      <div className="ops-map-activity-row">
        <div className="ops-card ops-card--map">
          <div className="ops-card-head">
            <h2 className="ops-card-title">Location Overview</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--ops-text-muted)' }}>
              {filtered.length} report{filtered.length !== 1 ? 's' : ''} shown
            </span>
          </div>
          <OpsMap
            cases={filtered}
            clusters={[]}
            selectedId={selectedId}
            onSelect={setSelectedId}
            heatmap={false}
            light
            center={mapCenter}
            showZoneOverlays={false}
            trafficZones={trafficZones}
            trafficHotspots={trafficHotspots}
          />
        </div>

        <div className="ops-card ops-card--activity">
          <div className="ops-card-head">
            <h2 className="ops-card-title">Recent Activity</h2>
            {activityLines.length > 0 && <span className="ops-queue-count">{activityLines.length}</span>}
          </div>
          <ul className="ops-activity-side-list">
            {activityLines.length === 0 ? (
              <li className="ops-activity-empty">No recent activity yet. Events appear here as reports are submitted and updated.</li>
            ) : (
              activityLines.map((a) => (
                <li key={a.key} className="ops-activity-side-item">
                  <span className="ops-activity-bottom-dot" aria-hidden />
                  <div>
                    <p className="ops-activity-bottom-text">{a.text}</p>
                    <time className="ops-activity-bottom-time">{a.time}</time>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="ops-card">
        <div className="ops-card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 className="ops-card-title">Report queue</h2>
            <span className="ops-queue-count">{filtered.length}</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ops-text-muted)' }}>
            Click any row to review and take action
          </p>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="ops-table-empty">No reports match your filters. Submit a report from the citizen app to see it here.</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}
                    className={`ops-table-row-clickable${selectedId === c.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(c.id)}
                    title="Click to view details"
                  >
                    <td className="ops-cell-mono">{c.id}</td>
                    <td>{c.ward}, {c.zone}</td>
                    <td>{c.issueType}</td>
                    <td><span className={`ops-sev-pill ops-sev-pill--${c.severity}`}>{c.severity}</span></td>
                    <td><span className={statusBadgeClass(c.status)}>{formatStatusLabel(c.status)}</span></td>
                    <td className="ops-cell-time">{new Date(c.submittedAt).toLocaleString()}</td>
                    <td><span className="ops-row-action-hint">View →</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Detail Modal */}

      {selectedId && (
        <ReportModal
          reportId={selectedId}
          detail={detail}
          loading={detailLoading}
          patching={patching}
          actionError={actionError}
          onClose={() => setSelectedId(null)}
          onVerify={() => void applyStatus('routed')}
          onInProgress={() => void applyStatus('in_progress')}
          onResolved={() => void applyStatus('resolved')}
          onReject={() => void applyStatus('rejected')}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Report Detail Modal
═══════════════════════════════════════════════ */
function ReportModal({
  reportId, detail, loading, patching, actionError,
  onClose, onVerify, onInProgress, onResolved, onReject,
}: {
  reportId: string; detail: OpsCase | null; loading: boolean;
  patching: boolean; actionError: string | null;
  onClose: () => void; onVerify: () => void;
  onInProgress: () => void; onResolved: () => void; onReject: () => void;
}) {
  const c = detail;
  const imgUrl = c?.image && 'data_url' in c.image ? c.image.data_url : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="ops-modal-overlay" onClick={onClose} role="dialog" aria-modal aria-label="Report detail">
      <div className="ops-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ops-modal-header">
          <div className="ops-modal-title-group">
            <p className="ops-modal-eyebrow">Report Detail</p>
            <h2 className="ops-modal-id">{c?.id ?? reportId}</h2>
          </div>
          {c && (
            <div className="ops-modal-header-badges">
              <span className={`ops-sev-pill ops-sev-pill--${c.severity}`}>{c.severity}</span>
              <span className={statusBadgeClass(c.status)}>{formatStatusLabel(c.status)}</span>
            </div>
          )}
          <button type="button" className="ops-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {actionError && <p className="ops-detail-error" style={{ margin: '0 1.5rem', padding: '0.5rem 0.75rem' }} role="alert">{actionError}</p>}
        {loading && !c && <p className="ops-detail-loading" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>Loading details…</p>}

        {/* Two-column body */}
        <div className="ops-modal-body">
          {/* Left: photo + metadata */}
          <div className="ops-modal-left">
            <div className={`ops-modal-photo${imgUrl ? ' ops-modal-photo--has-img' : ''}`}>
              {imgUrl
                ? <img src={imgUrl} alt="Report photo" className="ops-modal-photo-img" />
                : <span className="ops-modal-photo-placeholder">{c?.image?.present ? '📷 Photo on file' : '📷 No photo submitted'}</span>
              }
            </div>
            {c && (
              <dl className="ops-modal-meta">
                <div className="ops-modal-meta-item"><dt>Location</dt><dd>{c.lat.toFixed(5)}, {c.lon.toFixed(5)}</dd></div>
                <div className="ops-modal-meta-item"><dt>Ward / Zone</dt><dd>{c.ward} · {c.zone}</dd></div>
                <div className="ops-modal-meta-item"><dt>Road type</dt><dd>{c.roadType}</dd></div>
                <div className="ops-modal-meta-item"><dt>AI confidence</dt><dd>{(c.confidence * 100).toFixed(1)}%</dd></div>
                <div className="ops-modal-meta-item"><dt>Traffic profile</dt><dd>{trafficLabel(c.trafficLevel)}{c.peakTrafficNow ? ' (peak now)' : ''}</dd></div>
                <div className="ops-modal-meta-item"><dt>Priority score</dt><dd>{c.priorityScore ?? '—'} · {(c.priorityBand ?? 'scheduled').toUpperCase()}</dd></div>
                <div className="ops-modal-meta-item ops-modal-meta-item--full"><dt>Traffic hotspot</dt><dd>{c.trafficHotspot ?? 'No hotspot match'}</dd></div>
                <div className="ops-modal-meta-item ops-modal-meta-item--full"><dt>Peak window</dt><dd>{c.trafficPeakTime ?? 'Not available'}</dd></div>
                <div className="ops-modal-meta-item ops-modal-meta-item--full"><dt>Submitted</dt><dd>{new Date(c.submittedAt).toLocaleString()}</dd></div>
                <div className="ops-modal-meta-item ops-modal-meta-item--full"><dt>Assigned team</dt><dd>{c.assignedTo ?? '—'}</dd></div>
              </dl>
            )}
          </div>

          {/* Right: description + message + actions */}
          <div className="ops-modal-right">
            {c?.description && (
              <div className="ops-modal-section">
                <p className="ops-modal-section-label">Description</p>
                <p className="ops-modal-section-body">{c.description}</p>
              </div>
            )}
            {c?.priorityReason && (
              <div className="ops-modal-section">
                <p className="ops-modal-section-label">Priority rationale</p>
                <p className="ops-modal-section-body">{c.priorityReason}</p>
              </div>
            )}
            {c?.authorityMessage && (
              <div className="ops-modal-routed-msg">
                <p className="ops-modal-section-label">Routed Message</p>
                <p className="ops-modal-section-body">{c.authorityMessage}</p>
              </div>
            )}
            {c && (
              <div className="ops-modal-actions">
                <p className="ops-modal-section-label">Actions</p>
                <div className="ops-modal-action-grid">
                  <button type="button" className="ops-modal-btn ops-modal-btn--primary" disabled={patching || loading} onClick={onVerify}>✓ Verify / Route</button>
                  <button type="button" className="ops-modal-btn ops-modal-btn--amber" disabled={patching || loading} onClick={onInProgress}>⏳ In Progress</button>
                  <button type="button" className="ops-modal-btn ops-modal-btn--success" disabled={patching || loading} onClick={onResolved}>✓ Mark Resolved</button>
                  <button type="button" className="ops-modal-btn ops-modal-btn--danger" disabled={patching || loading} onClick={onReject}>✕ Reject</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
