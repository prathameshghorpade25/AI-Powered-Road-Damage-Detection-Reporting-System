import { useEffect, useState, useMemo } from 'react';
import OpsMap from '../components/OpsMap';
import { fetchAuthorityCases, fetchAuthorityTrafficHotspots, fetchAuthorityTrafficZones } from '../api/authorityApi';
import type { OpsCase, TrafficHotspot, TrafficZone } from '../opsTypes';

export default function AuthorityMapPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cases, setCases] = useState<OpsCase[]>([]);
  const [trafficZones, setTrafficZones] = useState<TrafficZone[]>([]);
  const [trafficHotspots, setTrafficHotspots] = useState<TrafficHotspot[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [res, zoneRes, hotspotRes] = await Promise.all([
          fetchAuthorityCases(),
          fetchAuthorityTrafficZones(),
          fetchAuthorityTrafficHotspots(),
        ]);
        setCases(res.cases);
        setTrafficZones(zoneRes.zones);
        setTrafficHotspots(hotspotRes.hotspots);
      } catch (e) {
        console.error(e);
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(t);
  }, []);

  const mapCenter = useMemo((): [number, number] => {
    if (trafficHotspots.length > 0) return [trafficHotspots[0].lat, trafficHotspots[0].lon];
    if (cases.length > 0) return [cases[0].lat, cases[0].lon];
    return [19.878, 74.48];
  }, [cases, trafficHotspots]);

  return (
    <div className="ops-dashboard" style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <div className="ops-workspace" style={{ height: '100%', paddingBottom: '1rem' }}>
        <div className="ops-workspace-main" style={{ height: '100%' }}>
          <div className="ops-card ops-card--map" style={{ height: '100%', marginBottom: 0 }}>
            <div className="ops-card-head" style={{ padding: '0.75rem 1rem' }}>
              <div className="ops-chip-row">
                <select className="ops-select ops-select--compact" aria-label="Ward">
                  <option>All wards</option>
                  <option>Ward 05</option>
                </select>
                <select className="ops-select ops-select--compact" aria-label="Zone">
                  <option>All zones</option>
                  <option>North</option>
                </select>
                <span className="ops-chip-sep" aria-hidden />
                <button type="button" className="ops-chip ops-chip--sev-severe">severe</button>
                <button type="button" className="ops-chip ops-chip--sev-moderate">moderate</button>
                <button type="button" className="ops-chip ops-chip--sev-minor">minor</button>
                <span className="ops-chip-sep" aria-hidden />
                <button type="button" className="ops-chip">new</button>
                <button type="button" className="ops-chip">in progress</button>
              </div>
            </div>
            {/* The OpsMap uses relative positioning normally. For Map-first page, let it fill */}
            <OpsMap 
              cases={cases} 
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
        </div>

        <aside className="ops-detail" aria-label="Map report detail">
          {selectedId ? (
            <div className="ops-detail-inner">
              <div className="ops-detail-top">
                <h2 className="ops-detail-id">{selectedId}</h2>
                <button type="button" className="ops-detail-close" onClick={() => setSelectedId(null)} aria-label="Close detail">×</button>
              </div>
              <div className="ops-detail-photo" style={{ background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px' }}>
                <span style={{ color: '#64748b' }}>Photo Thumbnail</span>
              </div>
              <dl className="ops-detail-dl" style={{ fontSize: '0.875rem' }}>
                <div><dt>Location</dt><dd>19.87842, 74.48211<br/>Ward 05, North</dd></div>
                <div><dt>Severity</dt><dd><span className="ops-sev-pill ops-sev-pill--severe">Severe</span></dd></div>
                <div><dt>AI confidence</dt><dd>92.1%</dd></div>
                <div><dt>Status</dt><dd><span className="ops-badge ops-badge--warn">In Progress</span></dd></div>
                <div><dt>Assigned team</dt><dd>Team Alpha</dd></div>
              </dl>
              <div className="ops-detail-actions" style={{ flexDirection: 'column' }}>
                <button type="button" className="ops-btn ops-btn--primary" style={{ width: '100%', justifyContent: 'center' }}>Open Report</button>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="ops-btn ops-btn--secondary" style={{ flex: 1, justifyContent: 'center' }}>Verify</button>
                  <button type="button" className="ops-btn ops-btn--secondary" style={{ flex: 1, justifyContent: 'center' }}>Assign</button>
                </div>
                <button type="button" className="ops-btn ops-btn--success" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>Mark resolved</button>
              </div>
            </div>
          ) : (
            <div className="ops-detail-empty">
              <p>Click a marker on the map to view details.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
