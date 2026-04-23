import { apiUrl } from '../lib/apiBase';

const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (API_KEY) h['x-api-key'] = API_KEY;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export type RemoteReportRow = {
  id: string;
  created_at_ms: number;
  issue_type?: string;
  severity?: string;
  location_summary?: string;
  ward?: string;
  routed_to?: string;
  lifecycle?: {
    phase: string;
    headline: string;
    authority_accepted: boolean;
    resolved: boolean;
  };
};

export type GeocodeResponse = {
  display_name?: string | null;
  address_line?: string | null;
  road?: string | null;
  suggested_landmarks?: string[];
  ward_hint?: string;
};

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResponse> {
  const res = await fetch(apiUrl('/citizen/geocode/reverse'), {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  return (await res.json()) as GeocodeResponse;
}

export async function previewAuthorityMessage(body: unknown): Promise<{ authority_message: string }> {
  const res = await fetch(apiUrl('/citizen/reports/preview-message'), {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Preview failed (${res.status})`);
  return (await res.json()) as { authority_message: string };
}

export async function listCitizenReports(deviceId: string): Promise<{ reports: RemoteReportRow[] }> {
  const q = new URLSearchParams({ device_id: deviceId, limit: '50' });
  const res = await fetch(`${apiUrl('/citizen/reports')}?${q}`, { headers: headers(false) });
  if (!res.ok) throw new Error(`List reports failed (${res.status})`);
  return (await res.json()) as { reports: RemoteReportRow[] };
}

export async function submitCitizenReport(
  payload: unknown,
  image: File | null,
): Promise<{
  report_id: string;
  created_at_ms: number;
  status: string;
  routed_to: Record<string, string>;
  authority_message: string;
}> {
  const fd = new FormData();
  fd.append('payload', JSON.stringify(payload));
  if (image) fd.append('image', image, image.name);
  const h: Record<string, string> = {};
  if (API_KEY) h['x-api-key'] = API_KEY;
  const res = await fetch(apiUrl('/citizen/reports/submit'), {
    method: 'POST',
    headers: h,
    body: fd,
  });
  if (!res.ok) {
    let msg = `Submit failed (${res.status})`;
    const text = await res.text();
    if (text) {
      try {
        const j = JSON.parse(text) as { detail?: string | unknown[] };
        if (typeof j.detail === 'string') msg = j.detail;
        else if (Array.isArray(j.detail)) {
          msg = j.detail
            .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: string }).msg) : JSON.stringify(d)))
            .join('; ');
        } else msg = text.slice(0, 500);
      } catch {
        msg = text.slice(0, 500);
      }
    }
    throw new Error(msg);
  }
  return (await res.json()) as {
    report_id: string;
    created_at_ms: number;
    status: string;
    routed_to: Record<string, string>;
    authority_message: string;
  };
}


