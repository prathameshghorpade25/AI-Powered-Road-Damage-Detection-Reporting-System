/** Backend-relative path, e.g. `/citizen/reports/submit` */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  if (base) return `${base}${p}`;
  if (import.meta.env.DEV) return `/api${p}`;
  return `http://127.0.0.1:8000${p}`;
}
