import { useState } from 'react';
import { useCivic } from '../context/CivicContext';
import '../report/report.css';

export default function SettingsPage() {
  const { profile, setProfile } = useCivic();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <section className="dash-hero">
        <h2>Settings</h2>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Identity</h3>
        <label className="rep-label">
          Display name
          <input className="rep-input" value={profile.displayName} onChange={(e) => setProfile({ displayName: e.target.value })} />
        </label>
        <label className="dash-check" style={{ marginTop: '0.75rem' }}>
          <input
            type="checkbox"
            checked={profile.anonymousPreferred}
            onChange={(e) => setProfile({ anonymousPreferred: e.target.checked })}
          />
          Prefer anonymous submissions by default
        </label>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Contact & verification (local demo)</h3>
        <label className="rep-label">
          Email
          <input className="rep-input" type="email" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} />
        </label>
        <label className="rep-label">
          Phone
          <input className="rep-input" type="tel" value={profile.phone} onChange={(e) => setProfile({ phone: e.target.value })} />
        </label>
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Language & home area</h3>
        <label className="rep-label">
          Language
          <select className="rep-input" value={profile.language} onChange={(e) => setProfile({ language: e.target.value as 'en' | 'hi' })}>
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </select>
        </label>
        <label className="rep-label">
          Home area / default ward hint
          <input className="rep-input" value={profile.homeArea} onChange={(e) => setProfile({ homeArea: e.target.value })} />
        </label>
      </section>

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-start' }}>
        <button type="button" className="ai-btn ai-btn-primary" onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Details'}
        </button>
      </div>
    </>
  );
}
