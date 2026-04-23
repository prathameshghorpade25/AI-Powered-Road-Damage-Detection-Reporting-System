import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCivic } from '../context/CivicContext';
import { ImageGeneration } from '../components/ImageGeneration';
import { AnimatedButton } from '../components/AnimatedButton';
import { reverseGeocode } from '../report/reportApi';
import { compositeDetectionImageDataUrl } from './compositeImage';
import type { Detection } from './types';
import { apiUrl } from '../lib/apiBase';

const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function drawDetectionsOverlay(canvas: HTMLCanvasElement, image: HTMLImageElement, detections: Detection[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || image.naturalWidth === 0 || image.naturalHeight === 0) return;

  const displayWidth = image.clientWidth;
  const displayHeight = image.clientHeight;
  const scaleX = displayWidth / image.naturalWidth;
  const scaleY = displayHeight / image.naturalHeight;

  canvas.width = displayWidth;
  canvas.height = displayHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((det) => {
    const [x1, y1, x2, y2] = det.box;
    const left = x1 * scaleX;
    const top = y1 * scaleY;
    const width = (x2 - x1) * scaleX;
    const height = (y2 - y1) * scaleY;

    const color = det.condition === 'serious' ? '#f43f5e' : det.condition === 'moderate' ? '#fb923c' : '#34d399';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, width, height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    const conditionText = det.condition.charAt(0).toUpperCase() + det.condition.slice(1);
    const label = `${det.label} - ${conditionText} (${(det.confidence * 100).toFixed(1)}%)`;
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    const pad = 6;
    ctx.fillRect(left + 2, Math.max(0, top - 20), tw + pad * 2, 18);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, left + 2 + pad, Math.max(14, top - 6));
  });
}

type Props = {
  /** Larger hero copy for the home route */
  variant?: 'home' | 'scan';
};

export default function PotholeScanWorkspace({ variant = 'scan' }: Props) {
  const { addActivity, setLastScan, setLastScanImageFile, setLastScanResultPreview } = useCivic();
  const uploadRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [phase, setPhase] = useState<'idle' | 'permissions' | 'scanning' | 'done' | 'error'>('idle');
  const [statusLine, setStatusLine] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl || !imageRef.current || !canvasRef.current) return;
    const img = imageRef.current;
    const canvas = canvasRef.current;
    const redraw = () => {
      if (!canvasRef.current || !imageRef.current) return;
      if (detections.length > 0) {
        drawDetectionsOverlay(canvasRef.current, imageRef.current, detections);
      } else {
        const ctx = canvas.getContext('2d');
        if (ctx && img.clientWidth) {
          canvas.width = img.clientWidth;
          canvas.height = img.clientHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
    if (img.complete) redraw();
    else img.onload = redraw;
  }, [detections, imageUrl]);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (phase !== 'done' || !imageRef.current) return;
    const img = imageRef.current;
    const applyComposite = () => {
      if (detections.length > 0) {
        const dataUrl = compositeDetectionImageDataUrl(img, detections);
        if (dataUrl) setLastScanResultPreview(dataUrl);
      } else {
        setLastScanResultPreview(null);
      }
    };
    if (img.complete && img.naturalWidth > 0) applyComposite();
    else img.onload = applyComposite;
  }, [phase, detections, imageUrl, setLastScanResultPreview]);

  const runPipeline = async (file: File) => {
    setErrorMessage(null);
    setDetections([]);
    setLastFile(file);
    setLastScanImageFile(file);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPhase('permissions');
    setStatusLine('Requesting access to your location…');
    addActivity('scan', 'Image received for autonomous analysis');

    let lat = 0;
    let lon = 0;
    let accuracyM: number | null = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12_000,
            maximumAge: 0,
          });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        accuracyM = pos.coords.accuracy ?? null;
        setStatusLine('Location attached. Scanning image…');
        addActivity('location', `GPS locked (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
      } catch {
        setStatusLine('Location unavailable. Scanning image…');
        addActivity('location', 'GPS unavailable — scan continues without coordinates');
      }
    } else {
      setStatusLine('Scanning image…');
    }

    setPhase('scanning');
    addActivity('model', 'Running pothole detection model…');
    try {
      const form = new FormData();
      form.append('file', file);
      const headers: HeadersInit = {};
      if (API_KEY) headers['x-api-key'] = API_KEY;
      const response = await fetch(`${apiUrl('/reports/process')}?lat=${lat}&lon=${lon}`, {
        method: 'POST',
        headers,
        body: form,
      });
      if (!response.ok) {
        let msg = `Scan failed (${response.status})`;
        try {
          const body = (await response.json()) as { detail?: string };
          if (response.status === 401) {
            msg = 'Scan failed: API key rejected. Please check frontend/backend API key configuration.';
          } else if (typeof body.detail === 'string' && body.detail.trim()) {
            msg = `Scan failed: ${body.detail}`;
          }
        } catch {
          if (response.status === 401) {
            msg = 'Scan failed: API key rejected. Please check frontend/backend API key configuration.';
          }
        }
        throw new Error(msg);
      }
      const json = (await response.json()) as { detections: Detection[] };
      setDetections(json.detections ?? []);
      const count = json.detections?.length ?? 0;
      setStatusLine(
        count === 0
          ? 'Scan complete. No potholes detected in this image.'
          : `Scan complete. ${count} pothole${count === 1 ? '' : 's'} detected.`,
      );
      setPhase('done');

      let wardHint: string | undefined;
      if (lat && lon) {
        try {
          const g = await reverseGeocode(lat, lon);
          wardHint = g.ward_hint ?? undefined;
          addActivity('geocode', 'Location verified against jurisdiction data');
        } catch {
          addActivity('geocode', 'Could not reverse-geocode — check API or network');
        }
      }
      const topConf = count ? Math.max(...(json.detections ?? []).map((d) => d.confidence)) : 0;
      addActivity(
        'detection',
        count
          ? `Pothole signal: ${count} detection(s) · peak confidence ${(topConf * 100).toFixed(1)}%`
          : 'Model: no pothole class above threshold',
      );
      setLastScan({
        at: Date.now(),
        lat: lat || 0,
        lon: lon || 0,
        accuracyM,
        detections: (json.detections ?? []).map((d) => ({
          label: d.label,
          condition: d.condition,
          confidence: d.confidence,
        })),
        count,
        geocodedWard: wardHint,
      });
    } catch (e) {
      setPhase('error');
      setErrorMessage((e as Error).message);
      setStatusLine('');
      addActivity('error', `Scan failed: ${(e as Error).message}`);
    }
  };

  const startCamera = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch {
      setErrorMessage('Could not access camera. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
    }

    stopCamera();

    if (ctx) {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
          void runPipeline(file);
        } else {
          setErrorMessage('Failed to capture image. Blob generation failed.');
        }
      }, 'image/jpeg', 0.9);
    } else {
      setErrorMessage('Failed to capture image. Canvas context missing.');
    }
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    void runPipeline(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void runPipeline(file);
    }
  };

  const isHome = variant === 'home';

  return (
    <>
      <main className="ai-main">
        {isHome ? (
          <section 
            className={`ai-dropzone-hero ${isDragging ? 'is-dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-labelledby="intake-heading"
          >
            <div className="ai-dropzone-bg-anim" aria-hidden="true" />
            <div className="ai-dropzone-content">
              <div className="ai-dropzone-icon" aria-hidden="true">✦</div>
              <h2 id="intake-heading" className="ai-dropzone-title">
                Analyze Road Conditions
              </h2>
              <p className="ai-dropzone-lead">
                Drop a photo here or use your camera. Our AI instantly detects damage severity, tags exact coordinates, and routes the report to the correct authority.
              </p>
              <div className="ai-actions">
                <AnimatedButton
                  type="button"
                  onClick={() => uploadRef.current?.click()}
                  disabled={phase === 'scanning' || isCameraActive}
                >
                  <span className="ai-btn-icon" aria-hidden />
                  Upload photo
                </AnimatedButton>
                <AnimatedButton
                  type="button"
                  onClick={startCamera}
                  disabled={phase === 'scanning' || isCameraActive}
                >
                  <span className="ai-btn-icon ai-btn-icon-cam" aria-hidden />
                  Use camera
                </AnimatedButton>
              </div>
            </div>
            <input ref={uploadRef} type="file" accept="image/*" className="ai-hidden-input" onChange={onPickFile} />
          </section>
        ) : (
          <section className="ai-card" aria-labelledby="intake-heading">
            <h2 id="intake-heading" className="sr-only">Upload or capture a road image</h2>
            <p className="ai-lead">
              Add a photo of the road surface. We request location when needed, run the model, and show detections.
            </p>
            <div className="ai-actions">
              <AnimatedButton
                type="button"
                onClick={() => uploadRef.current?.click()}
                disabled={phase === 'scanning' || isCameraActive}
              >
                <span className="ai-btn-icon" aria-hidden />
                Upload photo
              </AnimatedButton>
              <AnimatedButton
                type="button"
                onClick={startCamera}
                disabled={phase === 'scanning' || isCameraActive}
              >
                <span className="ai-btn-icon ai-btn-icon-cam" aria-hidden />
                Use camera
              </AnimatedButton>
            </div>
            <input ref={uploadRef} type="file" accept="image/*" className="ai-hidden-input" onChange={onPickFile} />
          </section>
        )}

        {errorMessage && (
          <section className="ai-card" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <p className="ai-status ai-status-err">{errorMessage}</p>
          </section>
        )}

        {(phase === 'permissions' || phase === 'scanning') && (
          <section className="ai-card" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <div className="ai-progress" role="status">
              <span className="ai-spinner" aria-hidden />
              <span>{statusLine}</span>
            </div>
          </section>
        )}

        {imageUrl && (
          <section className="ai-split-panel" aria-label="Analysis Results">
            {/* Left: Image Viewport */}
            <div className="ai-split-left">
              <ImageGeneration isScanning={phase === 'scanning' || phase === 'permissions'}>
                <div className="ai-preview-rigid">
                  <div className="ai-preview-wrapper">
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="Analyzed road image with pothole highlights"
                      className="ai-preview-img"
                      onLoad={() => {
                        if (imageRef.current && canvasRef.current && detections.length > 0) {
                          drawDetectionsOverlay(canvasRef.current, imageRef.current, detections);
                        }
                      }}
                    />
                    <canvas ref={canvasRef} className="ai-preview-canvas" />
                  </div>
                </div>
              </ImageGeneration>
            </div>

            {/* Right: Data & Actions */}
            {phase === 'done' && !errorMessage && lastFile && (
              <div className="ai-split-right">
                <div className="ai-results-header">
                  <span className="ai-status-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Scan Complete
                  </span>
                </div>
                
                <div className="ai-results-stats">
                  <h3 className="ai-stats-title">
                    {detections.length === 0 ? 'No Issues Detected' : `${detections.length} Pothole${detections.length === 1 ? '' : 's'} Detected`}
                  </h3>
                  
                  {detections.length > 0 && (
                    <ul className="ai-severity-list">
                      {['serious', 'moderate', 'minor'].map(sev => {
                        const count = detections.filter(d => d.condition === sev || (sev === 'minor' && d.condition !== 'serious' && d.condition !== 'moderate')).length;
                        if (count === 0) return null;
                        return (
                          <li key={sev}>
                            <span className={`sev-dot sev-${sev}`}></span>
                            {count} {sev.charAt(0).toUpperCase() + sev.slice(1)}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="ai-results-meta">
                  <div className="meta-row">
                    <span style={{ fontSize: '1.1rem' }}>📍</span> 
                    <span>Location and metadata tagged for report.</span>
                  </div>
                </div>

                <div className="ai-results-footer">
                  <p className="rep-muted-small">Ready to dispatch to the nearest roads authority.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Link to="/ai-composer" className="ai-btn" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', background: 'rgba(139, 92, 246, 0.1)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                      ✨ Auto-draft Complaint
                    </Link>
                    <Link to="/report" state={{ startStep: 1 }} className="ai-btn ai-btn-primary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
                      Continue to report
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {isCameraActive && (
        <div className="camera-overlay">
          <div className="camera-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
              onLoadedMetadata={() => videoRef.current?.play()}
            />
            <div className="camera-controls">
              <button type="button" className="ai-btn ai-btn-ghost" onClick={stopCamera}>
                Cancel
              </button>
              <button type="button" className="camera-snap-btn" onClick={takeSnapshot}>
                <div className="camera-snap-inner" />
              </button>
              <div style={{ width: '85px' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
