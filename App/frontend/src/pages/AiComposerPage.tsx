import { useState, useEffect } from 'react';

import { useCivic } from '../context/CivicContext';
import { submitCitizenReport } from '../report/reportApi';
import { useNavigate } from 'react-router-dom';
import { AnimatedButton } from '../components/AnimatedButton';
import './AiComposer.css';

const thoughts = [
  "Analyzing structural damage data...",
  "Identifying optimal municipal department...",
  "Synthesizing formal civic tone...",
  "Structuring evidence-based complaint...",
  "Applying regulatory compliance standards...",
  "Finalizing draft for dispatch..."
];

export default function AiComposerPage() {
  const civic = useCivic();
  const navigate = useNavigate();
  const [draftMessage, setDraftMessage] = useState('');
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [isTypewriting, setIsTypewriting] = useState(false);

  // Handle rotating thoughts during generation
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setThoughtIndex((prev) => (prev + 1) % thoughts.length);
      }, 2000);
    } else {
      setThoughtIndex(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const runTypewriter = (text: string) => {
    setIsTypewriting(true);
    setDisplayedMessage('');
    let index = 0;
    const speed = 15; // ms per character
    
    const timer = setInterval(() => {
      setDisplayedMessage(text.slice(0, index));
      index++;
      if (index > text.length) {
        clearInterval(timer);
        setIsTypewriting(false);
      }
    }, speed);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setDraftMessage('');
    setDisplayedMessage('');
    
    try {
      const apiKey = import.meta.env.VITE_XAI_API_KEY;
      if (!apiKey) {
        throw new Error('xAI API key is missing.');
      }

      const scanData = civic.lastScan;
      let promptContext = "No scan data available.";
      if (scanData) {
        promptContext = `Detected ${scanData.count} pothole(s). Location coordinates: ${scanData.lat}, ${scanData.lon}.`;
      }

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "grok-2-latest",
          messages: [
            {
              role: "system",
              content: "You are an automated civic assistant. Draft a formal, professional email to a municipal roads department reporting road damage based on the provided data. Be concise. Do not invent details. Provide only the email body without any pleasantries outside the email."
            },
            {
              role: "user",
              content: `Please draft a complaint message for the following road damage data: ${promptContext}`
            }
          ],
          temperature: 0.7,
          max_tokens: 400
        })
      });

      if (!response.ok) throw new Error(`xAI API error ${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      if (content) {
        setDraftMessage(content);
        // Small delay to feel more natural before typewriter starts
        setTimeout(() => runTypewriter(content), 500);
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      const fallback = `Dear Municipal Authority,\n\nI am reporting ${civic.lastScan?.count || 1} pothole(s) detected at ${civic.lastScan?.lat || 'N/A'}, ${civic.lastScan?.lon || 'N/A'}. This road damage requires immediate attention as it poses a safety risk.\n\nPlease schedule a repair for this location.\n\nRegards,\nCitizen Report #${Math.floor(Math.random() * 10000)}`;
      setDraftMessage(fallback);
      setTimeout(() => runTypewriter(fallback), 500);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!draftMessage.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const payload = {
        location: {
          lat: civic.lastScan?.lat || 0,
          lon: civic.lastScan?.lon || 0,
          location_confirmed: true
        },
        issue_type: 'pothole',
        severity: 'moderate',
        description: draftMessage,
        submission_mode: 'anonymous',
        allow_followup_contact: false,
        consent_service_improvement: true,
        consent_genuine: true,
        device_id: civic.deviceId
      };

      await submitCitizenReport(payload, civic.lastScanImageFile);
      setSuccess(true);
      setTimeout(() => navigate('/reports'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send report');
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(draftMessage);
    // Simple visual feedback could be added here
  };

  return (
    <div className="composer-container">
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Agentic Intelligence</span>
          <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(167, 139, 250, 0.3), transparent)' }}></div>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          AI Report Composer
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
          Finalize your civic report with automated linguistic optimization.
        </p>
      </div>

      {/* Context Strip */}
      <div className="context-strip">
        {civic.lastScanResultPreview ? (
          <img src={civic.lastScanResultPreview} alt="Scan Context" className="context-image-mini" />
        ) : (
          <div className="context-image-mini" style={{ background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📍</div>
        )}
        <div className="context-info">
          <span className="context-label">Detected Anomalies</span>
          <div className="context-value">
            <span style={{ fontWeight: 700, color: '#fff' }}>{civic.lastScan?.count || 0} Potholes</span>
            <span className="context-badge">
              {(() => {
                const dets = civic.lastScan?.detections || [];
                if (!dets.length) return 'MODERATE';
                const hasSerious = dets.some(d => d.condition === 'serious');
                const hasModerate = dets.some(d => d.condition === 'moderate');
                return (hasSerious ? 'SEVERE' : hasModerate ? 'MODERATE' : 'MINOR');
              })()}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }} className="context-info">
          <span className="context-label">Geospatial Lock</span>
          <span className="context-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {civic.lastScan?.lat?.toFixed(5)}, {civic.lastScan?.lon?.toFixed(5)}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center', fontWeight: 500 }}>
          ✓ Dispatch successful. Redirecting to transmission logs...
        </div>
      )}

      {/* Neural Workspace */}
      <div className={`neural-workspace ${isGenerating ? 'is-generating' : ''}`}>
        <div className="neural-workspace-header">
          <div className="ai-status-indicator">
            <div className={`status-dot ${isGenerating ? 'active' : ''}`}></div>
            <span>{isGenerating ? 'NEURAL PROCESSING ACTIVE' : draftMessage ? 'DRAFT READY FOR REVIEW' : 'SYSTEM IDLE'}</span>
          </div>
          {draftMessage && !isGenerating && (
            <div className="draft-toolbar">
              <button className="mini-action-btn" onClick={copyToClipboard}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy
              </button>
              <button className="mini-action-btn" onClick={handleGenerate}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                Regenerate
              </button>
            </div>
          )}
        </div>

        {isGenerating ? (
          <div className="thought-stream-container">
            <div className="neural-core-icon">🧠</div>
            <div className="thought-line">
              {thoughts[thoughtIndex]}
            </div>
            <div style={{ marginTop: '1rem', width: '200px', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '40%', background: '#a78bfa', boxShadow: '0 0 10px #a78bfa', animation: 'btn-sweep 1.5s infinite linear' }}></div>
            </div>
          </div>
        ) : (
          <div className="draft-workspace">
            <textarea
              className={`draft-textarea ${isTypewriting ? 'typewriter-cursor' : ''}`}
              value={isTypewriting ? displayedMessage : draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              placeholder="Initialize AI report synthesis by clicking the button below..."
              readOnly={isTypewriting}
            />
          </div>
        )}
      </div>

      <div className="composer-footer">
        <AnimatedButton
          onClick={handleGenerate}
          disabled={isGenerating || isSending}
          style={{ width: 'auto' }}
        >
          <span className="ai-btn-icon ai-btn-icon-sparkle" style={{ opacity: 0.8 }} aria-hidden />
          {draftMessage ? '🔄 Re-synthesize' : '✨ Generate Draft with AI'}
        </AnimatedButton>

        <AnimatedButton
          onClick={handleSend}
          disabled={isSending || !draftMessage.trim() || success || isTypewriting}
          className="ai-btn-primary"
          style={{ width: 'auto' }}
        >
          <span className="ai-btn-icon ai-btn-icon-dispatch" style={{ opacity: 0.8 }} aria-hidden />
          {isSending ? 'DISPATCHING...' : '🚀 DISPATCH TO AUTHORITY'}
        </AnimatedButton>
      </div>
    </div>
  );
}
