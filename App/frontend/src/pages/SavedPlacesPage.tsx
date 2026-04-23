import { useState } from 'react';
import { useCivic } from '../context/CivicContext';
import '../report/report.css';

export default function SavedPlacesPage() {
  const { savedPlaces, addSavedPlace, removePlace, bumpPlaceUse } = useCivic();
  const [label, setLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [address, setAddress] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (!label.trim() || Number.isNaN(la) || Number.isNaN(lo)) return;
    addSavedPlace({ label: label.trim(), lat: la, lon: lo, address: address.trim() || undefined });
    setLabel('');
    setLat('');
    setLon('');
    setAddress('');
  };

  return (
    <>
      <section className="dash-hero">
        <h2>Saved places</h2>
        <p className="dash-hero-lead">Home, office, or frequent segments — tap use count to prioritize.</p>
      </section>
      <section className="dash-card">
        <h3 className="dash-card-title">Add place</h3>
        <form onSubmit={submit} className="rep-grid" style={{ display: 'grid', gap: '0.65rem' }}>
          <label className="rep-label">
            Label
            <input className="rep-input" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <label className="rep-label">
            Latitude
            <input className="rep-input" value={lat} onChange={(e) => setLat(e.target.value)} required />
          </label>
          <label className="rep-label">
            Longitude
            <input className="rep-input" value={lon} onChange={(e) => setLon(e.target.value)} required />
          </label>
          <label className="rep-label" style={{ gridColumn: '1 / -1' }}>
            Address (optional)
            <input className="rep-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <button type="submit" className="ai-btn ai-btn-primary">
            Save place
          </button>
        </form>
      </section>
      <section className="dash-card">
        <h3 className="dash-card-title">Frequent</h3>
        {savedPlaces.length === 0 ? (
          <p className="dash-muted">No saved places.</p>
        ) : (
          <ul className="dash-mini-list">
            {savedPlaces.map((p) => (
              <li key={p.id} style={{ marginBottom: '0.5rem' }}>
                <strong>{p.label}</strong> · {p.address ?? `${p.lat}, ${p.lon}`} · used {p.useCount}x
                <div>
                  <button type="button" className="dash-link" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => bumpPlaceUse(p.id)}>
                    Bump use
                  </button>
                  {' · '}
                  <button type="button" className="dash-link" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => removePlace(p.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
