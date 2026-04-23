import type { Detection } from './types';

/** Draw full-resolution image with detection boxes (natural pixel coordinates). */
export function drawDetectionsOnImageCanvas(img: HTMLImageElement, detections: Detection[]): HTMLCanvasElement | null {
  if (img.naturalWidth === 0) return null;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const line = Math.max(2, Math.round(w / 400));
  const fontPx = Math.max(12, Math.round(w / 80));
  for (const det of detections) {
    const [x1, y1, x2, y2] = det.box;
    const color = det.condition === 'serious' ? '#f43f5e' : det.condition === 'moderate' ? '#fb923c' : '#34d399';
    ctx.strokeStyle = color;
    ctx.lineWidth = line;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    const conditionText = det.condition.charAt(0).toUpperCase() + det.condition.slice(1);
    const label = `${det.label} · ${conditionText} (${(det.confidence * 100).toFixed(0)}%)`;
    ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
    const tw = ctx.measureText(label).width;
    const pad = 6;
    const ly = Math.max(fontPx + 4, y1 - 4);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(x1, ly - fontPx - 4, tw + pad * 2, fontPx + 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, x1 + pad, ly);
  }
  return canvas;
}

export function compositeDetectionImageDataUrl(img: HTMLImageElement, detections: Detection[], quality = 0.88): string | null {
  const c = drawDetectionsOnImageCanvas(img, detections);
  return c ? c.toDataURL('image/jpeg', quality) : null;
}
