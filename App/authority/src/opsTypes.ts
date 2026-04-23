/** Shared types for municipal ops UI — aligned with GET /authority/reports */

export type Severity = 'minor' | 'moderate' | 'severe';

export type TrafficLevel = 'low' | 'medium' | 'high' | 'very_high';

export type OpsCaseImage = {
  present?: boolean;
  content_type?: string;
  data_base64?: string;
  data_url?: string;
};

export type OpsCase = {
  id: string;
  lat: number;
  lon: number;
  ward: string;
  zone: string;
  roadType: string;
  issueType: string;
  severity: Severity;
  confidence: number;
  status: string;
  assignedTo: string | null;
  slaTargetHours: number;
  submittedAt: string;
  submittedAtMs?: number;
  reporterType: 'anonymous' | 'named';
  reporterName?: string;
  description: string;
  duplicateClusterId: string | null;
  duplicateIndex: number;
  priorityReason: string | null;
  priorityScore?: number;
  priorityBand?: 'immediate' | 'today' | 'scheduled';
  trafficLevel?: TrafficLevel;
  trafficHotspot?: string | null;
  trafficPeakTime?: string | null;
  peakTrafficNow?: boolean;
  trafficMatchScore?: number;
  image?: OpsCaseImage | null;
  authorityMessage?: string;
  deviceId?: string | null;
  updatedAtMs?: number;
  resolvedAtMs?: number | null;
};

export type TrafficZone = {
  name: string;
  centerLat: number;
  centerLon: number;
  radiusM: number;
  trafficLevel: TrafficLevel;
  peakTime: string;
  hotspotCount: number;
  sampleLocations: string[];
};

export type TrafficHotspot = {
  address: string;
  zone: string;
  lat: number;
  lon: number;
  trafficLevel: TrafficLevel;
  peakTime: string;
  occurrences: number;
  radiusM: number;
};

export type DuplicateCluster = {
  id: string;
  centerLat: number;
  centerLon: number;
  count: number;
  firstReportId: string;
  reportIds: string[];
  radiusM: number;
};

export type AuthoritySummary = {
  newReports: number;
  highPriority: number;
  inProgress: number;
  resolvedToday: number;
  overdue: number;
  avgResponseHours: number;
  slaAlerts: number;
  highTrafficOpen?: number;
  peakHourCritical?: number;
  immediateDispatch?: number;
};
