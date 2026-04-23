import { useCivic } from '../context/CivicContext';
import '../report/report.css';

export default function PrivacyPage() {
  const { profile, setProfile, exportLocalDataJson, deleteAllLocalData } = useCivic();

  const downloadExport = () => {
    const blob = new Blob([exportLocalDataJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicroad-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section className="dash-hero">
        <h2>Privacy & consent</h2>
        <p className="dash-hero-lead">Autonomous routing still requires visible, granular controls.</p>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Submission & contact</h3>
        <label className="dash-check">
          <input type="checkbox" checked={profile.anonymousPreferred} onChange={(e) => setProfile({ anonymousPreferred: e.target.checked })} />
          Default to anonymous mode for new reports
        </label>
        <label className="dash-check">
          <input type="checkbox" checked={profile.notifyEmail} onChange={(e) => setProfile({ notifyEmail: e.target.checked })} />
          Allow email contact for municipal follow-up (when you opt in per report)
        </label>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Image retention (policy placeholder)</h3>
        <label className="rep-label">
          Retain evidence metadata locally (days hint)
          <select
            className="rep-input"
            value={String(profile.imageRetentionDays)}
            onChange={(e) => setProfile({ imageRetentionDays: Number(e.target.value) })}
          >
            <option value="30">30</option>
            <option value="90">90</option>
            <option value="365">365</option>
          </select>
        </label>
        <p className="dash-muted">Server-side retention follows your municipality — replace with real policy text.</p>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Your data on this device</h3>
        <button type="button" className="ai-btn ai-btn-primary" style={{ marginRight: '0.5rem' }} onClick={downloadExport}>
          Download my reports (JSON)
        </button>
        <button
          type="button"
          className="ai-btn ai-btn-ghost"
          onClick={() => {
            if (confirm('Delete all local CivicRoad data on this browser? This cannot be undone.')) deleteAllLocalData();
          }}
        >
          Delete local data
        </button>
      </section>
    </>
  );
}
