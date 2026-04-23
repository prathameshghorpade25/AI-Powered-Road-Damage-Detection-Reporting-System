import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCivic } from '../context/CivicContext';
import { previewAuthorityMessage, reverseGeocode, submitCitizenReport } from './reportApi';
import './report.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const DRAFT_KEY = 'pothole-citizen-report-draft-v2';
const HISTORY_KEY = 'pothole-citizen-report-history-v1';

const STEP_LABELS = ['Start', 'Location', 'Details', 'Consent', 'Review', 'Done'];

function stripDataUrlPrefix(dataUrl: string | null): string | null {
  if (!dataUrl) return null;
  const i = dataUrl.indexOf('base64,');
  return i >= 0 ? dataUrl.slice(i + 7) : dataUrl;
}

function severityFromModelDetections(dets: { condition: string }[]): Severity {
  if (!dets.length) return 'moderate';
  const rank: Record<string, number> = { minor: 0, moderate: 1, serious: 2, severe: 2 };
  let max = 0;
  for (const d of dets) {
    const key = d.condition === 'serious' ? 'severe' : d.condition;
    max = Math.max(max, rank[key] ?? rank[d.condition] ?? 1);
  }
  return (['minor', 'moderate', 'severe'] as const)[max];
}

type IssueType = 'pothole' | 'crack' | 'broken_road' | 'water_filled' | 'other';
type Severity = 'minor' | 'moderate' | 'severe';
type SubMode = 'full_name' | 'anonymous';

type Draft = {
  step: number;
  location: {
    lat: number | null;
    lon: number | null;
    accuracyM: number | null;
    addressLine: string;
    ward: string;
    landmark: string;
    manualAddress: string;
    confirmed: boolean;
    permissionDenied: boolean;
    suggestions: string[];
  };
  media: { previewUrl: string | null; fileName: string | null };
  observation: {
    issueType: IssueType | '';
    description: string;
    severity: Severity | '';
    hazardNotes: string;
  };
  contact: {
    mode: SubMode;
    name: string;
    email: string;
    phone: string;
    followup: boolean;
    consentService: boolean;
    consentFollowup: boolean;
    consentGenuine: boolean;
    notifyOptIn: boolean;
  };
  annotationDataUrl: string | null;
};

const emptyDraft = (): Draft => ({
  step: 0,
  location: {
    lat: null,
    lon: null,
    accuracyM: null,
    addressLine: '',
    ward: '',
    landmark: '',
    manualAddress: '',
    confirmed: false,
    permissionDenied: false,
    suggestions: [],
  },
  media: { previewUrl: null, fileName: null },
  observation: { issueType: '', description: '', severity: '', hazardNotes: '' },
  contact: {
    mode: 'anonymous',
    name: '',
    email: '',
    phone: '',
    followup: false,
    consentService: false,
    consentFollowup: false,
    consentGenuine: false,
    notifyOptIn: false,
  },
  annotationDataUrl: null,
});

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const base = emptyDraft();
    return { ...base, ...parsed, location: { ...base.location, ...parsed.location }, media: { ...base.media, ...parsed.media }, observation: { ...base.observation, ...parsed.observation }, contact: { ...base.contact, ...parsed.contact } };
  } catch {
    return emptyDraft();
  }
}

function MapPan({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function ReportWizard() {
  const civic = useCivic();
  const location = useLocation();
  const scanHydratedFor = useRef<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reportId: string;
    authorityMessage: string;
    routed: Record<string, string>;
    atMs: number;
  } | null>(null);
  const [legalOpen, setLegalOpen] = useState<'privacy' | 'retention' | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  useEffect(() => {
    const toSave = {
      ...draft,
      media: { previewUrl: null, fileName: draft.media.fileName },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(toSave));
  }, [draft]);

  const mapCenter = useMemo((): [number, number] => {
    if (draft.location.lat != null && draft.location.lon != null) {
      return [draft.location.lat, draft.location.lon];
    }
    return [20.5937, 78.9629];
  }, [draft.location.lat, draft.location.lon]);

  const persistHistory = useCallback((entry: { id: string; at: number; issue: string; status: string }) => {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as typeof entry[];
    list.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
  }, []);

  const requestGeolocation = useCallback(() => {
    setGeoStatus('Locating…');
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported in this browser.');
      setTimeout(() => setLocModalOpen(false), 1000);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc = pos.coords.accuracy ?? null;
        setDraft((d) => ({
          ...d,
          location: { ...d.location, lat, lon, accuracyM: acc, confirmed: false },
        }));
        setGeoStatus('Resolving address…');
        try {
          const geo = await reverseGeocode(lat, lon);
          setDraft((d) => ({
            ...d,
            location: {
              ...d.location,
              addressLine: geo.address_line ?? geo.display_name ?? '',
              ward: geo.ward_hint ?? d.location.ward,
              suggestions: geo.suggested_landmarks ?? [],
            },
          }));
          setGeoStatus(`Accuracy ~${Math.round(acc ?? 0)} m`);
        } catch {
          setGeoStatus('GPS OK — address lookup failed. Enter details manually.');
        }
        setTimeout(() => setLocModalOpen(false), 1000);
      },
      () => {
        setDraft((d) => ({ ...d, location: { ...d.location, permissionDenied: true } }));
        setGeoStatus('Location blocked — use the map and manual address.');
        setTimeout(() => setLocModalOpen(false), 1500);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    if (draft.step === 1 && !locModalOpen && draft.location.lat == null) {
      setLocModalOpen(true);
    }
  }, [draft.step, draft.location.lat, locModalOpen]);


  const onMediaPick = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setMediaFile(file);
    setDraft((d) => {
      if (d.media.previewUrl) URL.revokeObjectURL(d.media.previewUrl);
      const url = URL.createObjectURL(file);
      return { ...d, media: { previewUrl: url, fileName: file.name } };
    });
  }, []);

  useEffect(() => {
    const f = civic.lastScanImageFile;
    const ls = civic.lastScan;
    if (!f || !ls) return;
    if (scanHydratedFor.current === ls.at) return;
    scanHydratedFor.current = ls.at;

    onMediaPick(f);
    const sev = severityFromModelDetections(ls.detections);
    const st = location.state as { startStep?: number } | null;
    const start = typeof st?.startStep === 'number' ? st.startStep : 1;
    const peak = ls.detections.length > 0 ? Math.max(...ls.detections.map((x) => x.confidence)) : 0;
    setDraft((d) => ({
      ...d,
      step: start,
      location: {
        ...d.location,
        lat: ls.lat || null,
        lon: ls.lon || null,
        accuracyM: ls.accuracyM ?? null,
        ward: ls.geocodedWard ?? '',
        confirmed: !!(ls.lat && ls.lon),
      },
      observation: {
        ...d.observation,
        issueType: 'pothole',
        severity: sev,
        description:
          ls.count > 0
            ? `Automated detection: ${ls.count} pothole(s); peak model confidence ${(peak * 100).toFixed(1)}%.`
            : 'No potholes detected above threshold; reporting for manual review.',
        hazardNotes: '',
      },
    }));

    if (ls.lat && ls.lon) {
      void reverseGeocode(ls.lat, ls.lon)
        .then((geo) => {
          setDraft((d) => ({
            ...d,
            location: {
              ...d.location,
              addressLine: geo.address_line ?? geo.display_name ?? d.location.addressLine,
              ward: geo.ward_hint ?? d.location.ward,
              suggestions: geo.suggested_landmarks ?? [],
            },
          }));
        })
        .catch(() => {});
    }
  }, [location.state, civic.lastScanImageFile, civic.lastScan, onMediaPick]);

  // Pre-fill contact details from profile when entering step 2 (Details)
  useEffect(() => {
    if (draft.step === 2) {
      const { profile } = civic;
      // Only pre-fill if the draft is empty and profile has data
      if (!draft.contact.name && !draft.contact.email && !draft.contact.phone && profile.displayName) {
        setDraft((d) => ({
          ...d,
          contact: {
            ...d.contact,
            mode: profile.anonymousPreferred ? 'anonymous' : 'full_name',
            name: profile.displayName || '',
            email: profile.email || '',
            phone: profile.phone || '',
          },
        }));
      }
    }
  }, [draft.step, civic.profile]);

  const buildSubmitPayload = useCallback(() => {
    return {
      location: {
        lat: draft.location.lat!,
        lon: draft.location.lon!,
        accuracy_m: draft.location.accuracyM ?? undefined,
        address_line: draft.location.addressLine || undefined,
        ward: draft.location.ward || undefined,
        landmark: draft.location.landmark || undefined,
        manual_address: draft.location.manualAddress || undefined,
        location_confirmed: draft.location.confirmed,
      },
      issue_type: draft.observation.issueType,
      description: draft.observation.description.trim() || null,
      severity: draft.observation.severity,
      hazard_notes: draft.observation.hazardNotes.trim() || null,
      annotation_image_base64: stripDataUrlPrefix(civic.lastScanResultPreview),
      submission_mode: draft.contact.mode,
      name: draft.contact.mode === 'full_name' ? draft.contact.name.trim() : null,
      email: draft.contact.followup ? draft.contact.email.trim() || null : null,
      phone: draft.contact.followup ? draft.contact.phone.trim() || null : null,
      allow_followup_contact: draft.contact.followup,
      consent_service_improvement: draft.contact.consentService,
      consent_followup_contact: draft.contact.consentFollowup,
      consent_genuine: draft.contact.consentGenuine,
      notification_opt_in: draft.contact.notifyOptIn,
      locale: civic.profile.language,
      device_id: civic.deviceId,
      detection_peak_confidence: (() => {
        const ls = civic.lastScan;
        if (!ls?.detections?.length) return undefined;
        return Math.max(...ls.detections.map((d) => d.confidence));
      })(),
      // Include profile data for reference
      profile_name: civic.profile.displayName || null,
      profile_email: civic.profile.email || null,
      profile_phone: civic.profile.phone || null,
    };
  }, [draft, civic.deviceId, civic.profile, civic.lastScanResultPreview]);

  const buildPreviewBody = useCallback(() => {
    return {
      location: {
        lat: draft.location.lat!,
        lon: draft.location.lon!,
        accuracy_m: draft.location.accuracyM ?? undefined,
        address_line: draft.location.addressLine || undefined,
        ward: draft.location.ward || undefined,
        landmark: draft.location.landmark || undefined,
        manual_address: draft.location.manualAddress || undefined,
      },
      issue_type: draft.observation.issueType,
      description: draft.observation.description.trim() || null,
      severity: draft.observation.severity,
      hazard_notes: draft.observation.hazardNotes.trim() || null,
      submission_mode: draft.contact.mode,
      name: draft.contact.mode === 'full_name' ? draft.contact.name.trim() : null,
      email: draft.contact.followup ? draft.contact.email.trim() || null : null,
      phone: draft.contact.followup ? draft.contact.phone.trim() || null : null,
      allow_followup_contact: draft.contact.followup,
    };
  }, [draft]);

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (draft.location.lat == null || draft.location.lon == null) return 'Set a location on the map or allow GPS.';
      if (!draft.location.confirmed) return 'Tap “Use this location” to confirm.';
    }
    if (s === 2) {
      if (!draft.observation.issueType) return 'Complete a scan on Home and open the report from there.';
      if (!draft.observation.severity) return 'Severity is required.';
      if (draft.observation.description.length > 250) return 'Description is too long.';
    }
    if (s === 3) {
      if (!draft.contact.consentService || !draft.contact.consentGenuine) return 'Please review and accept the required consents.';
      if (draft.contact.followup && !draft.contact.consentFollowup) return 'Allow follow-up consent is required when contact is enabled.';
      if (draft.contact.mode === 'full_name' && !draft.contact.name.trim()) return 'Enter your name or choose anonymous reporting.';
      if (draft.contact.followup) {
        const em = draft.contact.email.trim();
        const ph = draft.contact.phone.trim();
        if (!em && !ph) return 'Provide an email or phone for follow-up.';
        if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return 'Check the email format.';
        if (ph && !/^[\d+\-\s()]{7,}$/.test(ph)) return 'Check the phone format.';
      }
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(draft.step);
    if (err) {
      setInlineError(err);
      return;
    }
    setInlineError(null);
    setDraft((d) => ({ ...d, step: Math.min(4, d.step + 1) }));
  };

  const goBack = () => setDraft((d) => ({ ...d, step: Math.max(0, d.step - 1) }));

  const openConfirm = async () => {
    const err = validateStep(3) || validateStep(2) || validateStep(1);
    if (err) {
      setInlineError(err);
      return;
    }
    setInlineError(null);
    setConfirmOpen(true);
    setPreviewMsg('');
    setPreviewLoading(true);
    try {
      const prev = await previewAuthorityMessage(buildPreviewBody());
      setPreviewMsg(prev.authority_message);
    } catch {
      setPreviewMsg('Preview unavailable — your report will still be composed on send.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const payload = buildSubmitPayload();
    let file = mediaFile;
    try {
      if (!file && draft.media.previewUrl) {
        const r = await fetch(draft.media.previewUrl);
        const blob = await r.blob();
        file = new File([blob], draft.media.fileName || 'pothole-evidence.jpg', { type: blob.type || 'image/jpeg' });
      }
      const res = await submitCitizenReport(payload, file);
      setResult({
        reportId: res.report_id,
        authorityMessage: res.authority_message,
        routed: res.routed_to,
        atMs: res.created_at_ms,
      });
      persistHistory({ id: res.report_id, at: res.created_at_ms, issue: String(draft.observation.issueType), status: res.status });
      civic.addActivity('report', `Report ${res.report_id} sent · routed to ${res.routed_to?.ward ?? 'jurisdiction'}`);
      civic.addNotification(
        'Report routed',
        `${res.report_id} is with ${res.routed_to?.authority_name ?? 'roads authority'}. Track status under My reports.`,
        res.report_id,
      );
      void civic.refreshRemoteReports();
      civic.refreshDraftFlag();
      setConfirmOpen(false);
      setDraft((d) => ({ ...d, step: 5 }));
      localStorage.removeItem(DRAFT_KEY);
      civic.setLastScanImageFile(null);
      scanHydratedFor.current = null;
    } catch (e) {
      setSubmitError((e as Error).message);
      try {
        civic.enqueueOffline(JSON.stringify(payload), draft.media.previewUrl);
      } catch {
        /* ignore */
      }
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = () => {
    setDraftNotice('Draft saved on this device. Open Report issue from Home after your next scan if you need a fresh image.');
    window.setTimeout(() => setDraftNotice(null), 6000);
  };

  const downloadPdf = async () => {
    if (!result) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(
      `Report ${result.reportId}\n${new Date(result.atMs).toISOString()}\n\nAuthority: ${result.routed.authority_name ?? ''}\nDepartment: ${result.routed.department ?? ''}\n\n${result.authorityMessage}`,
      180,
    );
    doc.text(lines, 14, 20);
    doc.save(`${result.reportId}.pdf`);
  };


  const renderNavArrows = () => (
    <div className="rep-panel-footer">
      <button type="button" className="rep-nav-arrow" onClick={goBack} aria-label="Previous step">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      {draft.step !== 4 ? (
        <button type="button" className="rep-nav-arrow" onClick={goNext} aria-label="Next step">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      ) : (
        <div />
      )}
    </div>
  );

  const stepContent = () => {
    switch (draft.step) {
      case 0: {
        const hasMedia = !!(mediaFile || draft.media.previewUrl);
        if (!hasMedia) {
          return (
            <div className="rep-panel">
              <h2 className="rep-h2">Photo required</h2>
              <p className="rep-muted">
                Reports use the image and location from your home scan. Capture or upload a road photo there first, then
                tap &quot;Continue to report&quot;.
              </p>
              <Link to="/" className="ai-btn ai-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
                Go to Home
              </Link>
            </div>
          );
        }
        return (
          <div className="rep-panel">
            <h2 className="rep-h2">Report to the nearest authority</h2>
            <p className="rep-muted">
              Your scan photo, GPS position, and model output are attached. Confirm the map pin, review the detection
              image, accept consent, then send — we route using your coordinates.
            </p>
            <button type="button" className="ai-btn ai-btn-primary" onClick={() => setDraft((d) => ({ ...d, step: 1 }))}>
              Continue
            </button>
          </div>
        );
      }
      case 1:
        return (
          <div className="rep-panel rep-panel-map-focused">
            <h2 className="rep-h2" style={{ marginBottom: '0.25rem' }}>Where is the issue?</h2>
            <p className="rep-muted" style={{ marginBottom: '1.25rem' }}>
              AI automatically detected your coordinates from the photo. You can drag the pin to fine-tune.
            </p>
            {geoStatus && <p className="rep-status" style={{ marginBottom: '1rem' }}>{geoStatus}</p>}

            <div className="ai-map-container">
              <MapContainer center={mapCenter} zoom={16} className="rep-map-full" scrollWheelZoom>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapPan center={mapCenter} />
                <MapClickHandler
                  onPick={(lat, lng) =>
                    setDraft((d) => ({
                      ...d,
                      location: { ...d.location, lat, lon: lng, confirmed: false },
                    }))
                  }
                />
                {draft.location.lat != null && draft.location.lon != null && (
                  <Marker
                    position={[draft.location.lat, draft.location.lon]}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const p = e.target.getLatLng();
                        setDraft((d) => ({
                          ...d,
                          location: { ...d.location, lat: p.lat, lon: p.lng, confirmed: false },
                        }));
                      },
                    }}
                  />
                )}
              </MapContainer>

              <div className="ai-map-overlay">
                <div className="ai-overlay-header">
                  <span className="ai-overlay-icon">📍</span>
                  <div className="ai-overlay-text">
                    <strong>{draft.location.addressLine || 'Resolving location...'}</strong>
                    <small>
                      {draft.location.lat != null 
                        ? `${draft.location.lat.toFixed(5)}, ${draft.location.lon?.toFixed(5)}` 
                        : 'Waiting for GPS'}
                    </small>
                  </div>
                </div>

                {draft.location.suggestions.length > 0 && (
                  <div className="rep-chips" style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }} role="group" aria-label="Suggested landmarks">
                    {draft.location.suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`rep-chip ${draft.location.landmark === s ? 'rep-chip-active' : ''}`}
                        onClick={() => setDraft((d) => ({ ...d, location: { ...d.location, landmark: s } }))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="ai-btn ai-btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
                  onClick={() => {
                    setDraft((d) => ({ ...d, location: { ...d.location, confirmed: true } }));
                    goNext();
                  }}
                  disabled={draft.location.lat == null}
                >
                  Confirm Location &amp; Continue &rarr;
                </button>
              </div>
            </div>

            <details className="ai-advanced-location">
              <summary>Advanced Address Entry</summary>
              <div className="rep-grid" style={{ marginTop: '1rem' }}>
                <label className="rep-label">
                  Ward / zone (auto-detected)
                  <input
                    className="rep-input"
                    value={draft.location.ward}
                    onChange={(e) => setDraft((d) => ({ ...d, location: { ...d.location, ward: e.target.value } }))}
                  />
                </label>
                <label className="rep-label">
                  Manual address (if GPS blocked)
                  <textarea
                    className="rep-textarea"
                    rows={2}
                    value={draft.location.manualAddress}
                    onChange={(e) => setDraft((d) => ({ ...d, location: { ...d.location, manualAddress: e.target.value } }))}
                  />
                </label>
              </div>
            </details>
          </div>
        );
      case 2:
        return (
          <div className="rep-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span className="ai-status-pulse" style={{ width: 12, height: 12, background: '#a855f7', borderRadius: '50%', boxShadow: '0 0 10px #a855f7' }}></span>
              <h2 className="rep-h2" style={{ margin: 0 }}>AI Diagnostics</h2>
            </div>
            <p className="rep-muted" style={{ marginBottom: '1.5rem' }}>
              Review the automated findings below. Add any additional context if needed.
            </p>

            <div className="ai-diagnostics-grid">
              <div className="ai-diagnostics-image">
                {(civic.lastScanResultPreview || draft.media.previewUrl) ? (
                  <figure className="rep-detect-preview" style={{ margin: 0, height: '100%', display: 'flex', flexDirection: 'column', border: 'none' }}>
                    <img
                      src={civic.lastScanResultPreview || draft.media.previewUrl!}
                      alt="Road image with detected potholes highlighted"
                      className="rep-detect-preview-img"
                      style={{ flex: 1, objectFit: 'cover' }}
                    />
                    <figcaption className="rep-detect-caption">✨ Automated Scan Output</figcaption>
                  </figure>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <p className="rep-muted">No image provided</p>
                  </div>
                )}
              </div>

              <div className="ai-diagnostics-data">
                <div className="ai-stat-card">
                  <span className="ai-stat-label">Detected Issue</span>
                  <strong className="ai-stat-value">Pothole</strong>
                </div>
                
                <div className="ai-stat-card">
                  <span className="ai-stat-label">Severity</span>
                  <strong className="ai-stat-value" style={{ color: draft.observation.severity === 'severe' ? '#f87171' : draft.observation.severity === 'moderate' ? '#fbbf24' : '#4ade80' }}>
                    {draft.observation.severity ? draft.observation.severity.toUpperCase() : '—'}
                  </strong>
                </div>

                <div className="ai-stat-card">
                  <span className="ai-stat-label">Detection Count</span>
                  <strong className="ai-stat-value">{civic.lastScan ? civic.lastScan.count : 0} Anomaly(s)</strong>
                </div>

                <div className="ai-note-box" style={{ marginTop: 'auto', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label className="rep-label" style={{ marginBottom: '0.5rem' }}>
                    Additional Context <span style={{ fontWeight: 'normal', color: '#64748b' }}>({draft.observation.description.length}/250)</span>
                  </label>
                  <textarea
                    className="rep-textarea"
                    rows={3}
                    maxLength={250}
                    value={draft.observation.description}
                    onChange={(e) => setDraft((d) => ({ ...d, observation: { ...d.observation, description: e.target.value } }))}
                    placeholder="Add context the model might have missed…"
                    style={{ background: 'rgba(2, 6, 23, 0.5)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="ai-btn ai-btn-primary" onClick={goNext}>
                Looks Good &rarr;
              </button>
            </div>
            
            <div style={{ marginTop: '-2rem' }}>
              {renderNavArrows()}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="rep-panel">
            <h2 className="rep-h2">Identity &amp; Privacy</h2>
            <p className="rep-muted" style={{ marginBottom: '1.5rem' }}>Choose how you want to submit this report. Your privacy is our priority.</p>
            
            <div className="ai-mode-cards">
              <button 
                type="button"
                className={`ai-mode-card ${draft.contact.mode === 'anonymous' ? 'active' : ''}`}
                onClick={() => setDraft((d) => ({ ...d, contact: { ...d.contact, mode: 'anonymous', name: '', email: '', phone: '', followup: false } }))}
              >
                <div className="ai-mode-icon">🕵️</div>
                <div className="ai-mode-text">
                  <strong>Anonymous</strong>
                  <span>Report without sharing identity</span>
                </div>
              </button>

              <button 
                type="button"
                className={`ai-mode-card ${draft.contact.mode === 'full_name' ? 'active' : ''}`}
                onClick={() => setDraft((d) => ({ ...d, contact: { ...d.contact, mode: 'full_name' } }))}
              >
                <div className="ai-mode-icon">👤</div>
                <div className="ai-mode-text">
                  <strong>Named Profile</strong>
                  <span>Include details for follow-up</span>
                </div>
              </button>
            </div>

            {draft.contact.mode === 'full_name' && (
              <div className="ai-contact-fields" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeInDown 0.3s ease-out' }}>
                <label className="rep-label">
                  Full Name
                  <input
                    className="rep-input"
                    value={draft.contact.name}
                    onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, name: e.target.value } }))}
                  />
                </label>
                
                <div className="ai-toggle-row">
                  <div className="ai-toggle-label">
                    <strong>Allow contact for follow-up</strong>
                    <span>Authority may contact you regarding status updates</span>
                  </div>
                  <label className="ai-switch">
                    <input type="checkbox" checked={draft.contact.followup} onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, followup: e.target.checked } }))} />
                    <span className="ai-slider"></span>
                  </label>
                </div>

                {draft.contact.followup && (
                  <div className="rep-grid" style={{ animation: 'fadeInDown 0.3s ease-out' }}>
                    <label className="rep-label">
                      Email
                      <input
                        className="rep-input"
                        type="email"
                        value={draft.contact.email}
                        onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, email: e.target.value } }))}
                      />
                    </label>
                    <label className="rep-label">
                      Phone
                      <input
                        className="rep-input"
                        type="tel"
                        value={draft.contact.phone}
                        onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, phone: e.target.value } }))}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="ai-consent-box" style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Consents</h3>
              
              <div className="ai-toggle-row">
                <div className="ai-toggle-label">
                  <strong>Service &amp; Data Usage</strong>
                  <span>I consent to the use of my image and report data for municipal response.</span>
                </div>
                <label className="ai-switch">
                  <input type="checkbox" checked={draft.contact.consentService} onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, consentService: e.target.checked } }))} />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {draft.contact.followup && (
                <div className="ai-toggle-row">
                  <div className="ai-toggle-label">
                    <strong>Follow-up Contact</strong>
                    <span>I consent to be contacted if I requested follow-up.</span>
                  </div>
                  <label className="ai-switch">
                    <input type="checkbox" checked={draft.contact.consentFollowup} onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, consentFollowup: e.target.checked } }))} />
                    <span className="ai-slider"></span>
                  </label>
                </div>
              )}

              <div className="ai-toggle-row">
                <div className="ai-toggle-label">
                  <strong>Declaration of Accuracy</strong>
                  <span>I declare this report is genuine to the best of my knowledge.</span>
                </div>
                <label className="ai-switch">
                  <input type="checkbox" checked={draft.contact.consentGenuine} onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, consentGenuine: e.target.checked } }))} />
                  <span className="ai-slider"></span>
                </label>
              </div>
            </div>

            <div className="ai-toggle-row" style={{ marginTop: '1.5rem', padding: '0 0.5rem' }}>
              <div className="ai-toggle-label">
                <strong>Campaign Notifications (Optional)</strong>
                <span>Notify me about similar safety campaigns.</span>
              </div>
              <label className="ai-switch">
                <input type="checkbox" checked={draft.contact.notifyOptIn} onChange={(e) => setDraft((d) => ({ ...d, contact: { ...d.contact, notifyOptIn: e.target.checked } }))} />
                <span className="ai-slider"></span>
              </label>
            </div>

            <p className="rep-legal-links" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button type="button" className="rep-link" onClick={() => setLegalOpen('privacy')}>Privacy policy</button>
              <span aria-hidden> &middot; </span>
              <button type="button" className="rep-link" onClick={() => setLegalOpen('retention')}>Data retention</button>
            </p>

            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
              {renderNavArrows()}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="rep-panel rep-review-panel">
            <h2 className="rep-h2">Dispatch Ticket</h2>
            <p className="rep-muted">Final review before routing to the municipal authority.</p>

            <div className="rep-ticket-container">
              <div className="rep-ticket-header">
                <span className="rep-ticket-badge">READY TO DISPATCH</span>
                <span className="rep-ticket-id">TRK-{Date.now().toString().slice(-6)}</span>
              </div>
              
              <div className="rep-ticket-body">
                <div className="rep-ticket-row">
                  <span className="rep-ticket-label">Authority</span>
                  <span className="rep-ticket-value">Municipal Corporation — Roads &amp; Public Works</span>
                </div>
                
                <div className="rep-ticket-row">
                  <span className="rep-ticket-label">Location</span>
                  <span className="rep-ticket-value" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    <span style={{ textAlign: 'right' }}>{draft.location.addressLine || draft.location.manualAddress || 'Unknown location'}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {draft.location.lat != null ? `${draft.location.lat.toFixed(6)}, ${draft.location.lon?.toFixed(6)}` : ''}
                    </span>
                  </span>
                </div>

                <div className="rep-ticket-row">
                  <span className="rep-ticket-label">AI Diagnosis</span>
                  <span className="rep-ticket-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{draft.observation.severity.toUpperCase()}</span>
                    Pothole
                  </span>
                </div>

                <div className="rep-ticket-row">
                  <span className="rep-ticket-label">Reporter Mode</span>
                  <span className="rep-ticket-value">{draft.contact.mode === 'anonymous' ? 'Anonymous' : 'Named (Follow-up requested)'}</span>
                </div>
              </div>

              <div className="rep-ticket-footer">
                <div className="rep-actions rep-actions-split" style={{ width: '100%' }}>
                  <button type="button" className="ai-btn ai-btn-ghost" onClick={saveDraft}>
                    Save Draft
                  </button>
                  <button 
                    type="button" 
                    className="ai-btn ai-btn-primary" 
                    onClick={() => void openConfirm()}
                    style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}
                  >
                    SEND REPORT &rarr;
                  </button>
                </div>
              </div>
            </div>
            
            {submitError && <p className="ai-status ai-status-err" style={{ marginTop: '1rem' }}>{submitError}</p>}
            <div style={{ marginTop: '-1.5rem' }}>
              {renderNavArrows()}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="rep-panel ai-command-center-panel">
            <div className="ai-verification-core">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ai-check-path">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            
            <h2 className="ai-command-title">
              Report Successfully Submitted
            </h2>
            <p className="ai-command-subtext">
              Securely routed to the Municipal Corporation.
            </p>

            {result && (
              <div className="ai-command-summary-card">
                <div className="ai-command-row ai-group">
                  <div className="ai-command-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    Tracking ID
                  </div>
                  <div className="ai-command-value-wrapper">
                    <span className="ai-command-value" style={{ fontFamily: 'monospace', color: '#c4b5fd' }}>{result.reportId}</span>
                    <button type="button" className="ai-copy-btn" onClick={() => handleCopyId(result.reportId)} title="Copy ID">
                      {copiedId ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="ai-command-row">
                  <div className="ai-command-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    Status
                  </div>
                  <div className="ai-command-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="ai-live-dot"></span>
                    Routed
                  </div>
                </div>
                <div className="ai-command-row">
                  <div className="ai-command-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    Authority
                  </div>
                  <div className="ai-command-value">{result.routed.authority_name}</div>
                </div>
                <div className="ai-command-row" style={{ borderBottom: 'none' }}>
                  <div className="ai-command-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Timestamp
                  </div>
                  <div className="ai-command-value">{new Date(result.atMs).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                </div>
              </div>
            )}

            <div className="ai-command-actions">
              <button 
                type="button" 
                className="ai-btn ai-btn-primary ai-btn-pill" 
                onClick={() => {
                  setMediaFile(null);
                  setResult(null);
                  setSubmitError(null);
                  scanHydratedFor.current = null;
                  civic.setLastScanImageFile(null);
                  civic.setLastScanResultPreview(null);
                  setDraft(emptyDraft());
                }}
              >
                Start New Report
              </button>
              {result && (
                <button 
                  type="button" 
                  className="ai-btn-ghost-clean" 
                  onClick={() => void downloadPdf()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem', marginBottom: '-3px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download Summary
                </button>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="ai-main rep-main">
      {inlineError && (
        <p className="ai-status ai-status-err rep-inline-err" role="alert">
          {inlineError}
        </p>
      )}
      {draftNotice && (
        <p className="ai-status ai-status-ok rep-inline-err" role="status">
          {draftNotice}
        </p>
      )}
      <nav className="rep-stepper" aria-label="Report steps">
        <ol>
          {STEP_LABELS.map((label, i) => (
            <li key={label} className={i === draft.step ? 'active' : i < draft.step ? 'done' : ''} data-short={label.slice(0, 2)}>
              <span className="rep-step-label">{label}</span>
            </li>
          ))}
        </ol>
      </nav>
      {stepContent()}

      {locModalOpen && (
        <div className="rep-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="loc-modal-title">
          <div className="rep-modal">
            <h2 id="loc-modal-title" className="rep-h2">
              Use your location?
            </h2>
            <p className="rep-muted">We use GPS once to place the pin and route your report. You can adjust it on the map.</p>
            <div className="rep-actions rep-actions-split">
              <button
                type="button"
                className="ai-btn ai-btn-ghost"
                onClick={() => {
                  setLocModalOpen(false);
                }}
              >
                Not now
              </button>
              <button
                type="button"
                className="ai-btn ai-btn-primary"
                onClick={() => {
                  requestGeolocation();
                }}
              >
                Allow location
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="rep-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="rep-modal rep-modal-wide ai-transmission-modal">
            <div className="ai-transmission-header">
              <div className="ai-pulse-ring" style={{ width: 12, height: 12, background: '#8b5cf6', borderRadius: '50%', boxShadow: '0 0 10px #8b5cf6', animation: 'pulse-ring 2s infinite' }}></div>
              <h2 id="confirm-title" className="rep-h2" style={{ margin: 0 }}>Secure Dispatch Uplink</h2>
            </div>
            
            <div className="ai-routing-graphic">
              <div className="ai-routing-node">Citizen</div>
              <div className="ai-routing-line"><span className="ai-routing-dot"></span></div>
              <div className="ai-routing-node ai-routing-node-ai">AI Router</div>
              <div className="ai-routing-line"><span className="ai-routing-dot" style={{ animationDelay: '0.5s' }}></span></div>
              <div className="ai-routing-node">Authority</div>
            </div>

            <p className="rep-muted" style={{ textAlign: 'center', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              Routing report to: <strong style={{ color: '#c4b5fd' }}>Municipal Corporation — Roads &amp; Public Works</strong>
            </p>

            <div className="ai-transmission-terminal">
              <div className="ai-terminal-topbar">
                <span>payload.json</span>
                <span>encrypted</span>
              </div>
              {previewLoading ? (
                <div className="ai-terminal-loading">
                  <span className="ai-spinner"></span> Synthesizing report...
                </div>
              ) : (
                <pre className="ai-terminal-content" style={{ animation: 'typing 1s steps(40, end)' }}>{previewMsg}</pre>
              )}
            </div>

            <div className="rep-actions rep-actions-split" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="ai-btn ai-btn-ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Abort
              </button>
              <button 
                type="button" 
                className={`ai-btn ai-btn-primary ai-btn-launch ${submitting ? 'launching' : ''}`} 
                onClick={() => void doSubmit()} 
                disabled={submitting}
              >
                {submitting ? 'TRANSMITTING...' : '🚀 DISPATCH TO AUTHORITY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {legalOpen && (
        <div className="rep-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-title">
          <div className="rep-modal rep-modal-wide">
            <h2 id="legal-title" className="rep-h2">
              {legalOpen === 'privacy' ? 'Privacy policy' : 'Data retention'}
            </h2>
            <div className="rep-legal-body">
              {legalOpen === 'privacy' ? (
                <p>
                  We process location, photos, and descriptions only to route and respond to road safety reports.
                  Anonymous mode omits personal identifiers from the submission payload. Contact details are optional and
                  used only if you consent to follow-up. Replace this placeholder with your jurisdiction&apos;s official
                  privacy notice.
                </p>
              ) : (
                <p>
                  Retention defaults are defined by your municipality. Typical practice: evidence retained for the life of
                  the work order plus statutory limits. Replace this text with your official retention schedule.
                </p>
              )}
            </div>
            <button type="button" className="ai-btn ai-btn-primary" onClick={() => setLegalOpen(null)}>
              Close
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
