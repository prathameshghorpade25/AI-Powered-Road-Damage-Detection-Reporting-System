import type { AuthoritySummary, OpsCase, TrafficHotspot, TrafficZone } from '../opsTypes';
import { apiUrl } from './apiBase';

const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (API_KEY) h['x-api-key'] = API_KEY;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function fetchAuthorityCases(): Promise<{ cases: OpsCase[]; clusters: unknown[] }> {
  const res = await fetch(apiUrl('/authority/reports'), { headers: headers(false) });
  if (!res.ok) throw new Error(`Authority list failed (${res.status})`);
  return (await res.json()) as { cases: OpsCase[]; clusters: unknown[] };
}

export async function fetchAuthoritySummary(): Promise<AuthoritySummary> {
  const res = await fetch(apiUrl('/authority/summary'), { headers: headers(false) });
  if (!res.ok) throw new Error(`Authority summary failed (${res.status})`);
  const j = (await res.json()) as { summary: AuthoritySummary };
  return j.summary;
}

export async function fetchAuthorityMeta(): Promise<{ wards: string[]; zones: string[] }> {
  const res = await fetch(apiUrl('/authority/meta'), { headers: headers(false) });
  if (!res.ok) throw new Error(`Authority meta failed (${res.status})`);
  return (await res.json()) as { wards: string[]; zones: string[] };
}

export async function fetchAuthorityTrafficZones(): Promise<{ zones: TrafficZone[] }> {
  const res = await fetch(apiUrl('/authority/traffic-zones'), { headers: headers(false) });
  if (!res.ok) throw new Error(`Authority traffic-zones failed (${res.status})`);
  return (await res.json()) as { zones: TrafficZone[] };
}

export async function fetchAuthorityTrafficHotspots(): Promise<{ hotspots: TrafficHotspot[] }> {
  const res = await fetch(apiUrl('/authority/traffic-hotspots'), { headers: headers(false) });
  if (!res.ok) throw new Error(`Authority traffic-hotspots failed (${res.status})`);
  return (await res.json()) as { hotspots: TrafficHotspot[] };
}

export async function fetchAuthorityReport(id: string): Promise<OpsCase> {
  const res = await fetch(apiUrl(`/authority/reports/${encodeURIComponent(id)}`), {
    headers: headers(false),
  });
  if (!res.ok) throw new Error(`Report ${id} failed (${res.status})`);
  return (await res.json()) as OpsCase;
}

export async function patchAuthorityReport(
  id: string,
  body: { ops_status?: string; assigned_to?: string | null },
): Promise<OpsCase> {
  const res = await fetch(apiUrl(`/authority/reports/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t.slice(0, 400) || `Update failed (${res.status})`);
  }
  return (await res.json()) as OpsCase;
}
