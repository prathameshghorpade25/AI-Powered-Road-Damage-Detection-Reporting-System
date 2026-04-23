/** Label / badge helpers for ops UI (data comes from the API). */

import type { Severity } from './opsTypes';

export type { Severity, OpsCase, DuplicateCluster } from './opsTypes';

export function severityColor(s: Severity): string {
  if (s === 'severe') return '#dc2626';
  if (s === 'moderate') return '#d97706';
  return '#16a34a';
}

export function slaHoursLeft(submittedIso: string, slaHours: number): number {
  const deadline = new Date(submittedIso).getTime() + slaHours * 3600000;
  return (deadline - Date.now()) / 3600000;
}

/** Workflow status badge: semantic colours */
export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'resolved') return 'ops-badge ops-badge--resolved';
  if (s === 'in_progress') return 'ops-badge ops-badge--progress';
  if (s === 'new' || s === 'unverified' || s === 'routed') return 'ops-badge ops-badge--new';
  if (s === 'rejected') return 'ops-badge ops-badge--muted';
  return 'ops-badge ops-badge--muted';
}

export function formatStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'New',
    unverified: 'Unverified',
    routed: 'Routed',
    in_progress: 'In progress',
    resolved: 'Resolved',
    rejected: 'Rejected',
  };
  return map[status.toLowerCase()] ?? status;
}
