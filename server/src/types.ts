export type IncidentSeverity = 'info' | 'warning' | 'error' | 'critical';
export type SeverityKey = IncidentSeverity | 'global';

export interface SeverityMetrics {
  global: number;
  info: number;
  warning: number;
  error: number;
  critical: number;
}

export interface SeverityWeights {
  info: number;
  warning: number;
  error: number;
  critical: number;
}

export interface Incident {
  dedupKey: string;
  serviceId: string;
  serviceName: string;
  startedAt: number;
  incidentId: string | null;
  mapAttempts: number;
  lastMapAttemptAt?: number;
  nextEvalAt: number;
  ackAt: number | null;
  autoAckAt: number | null;
  acked: boolean;
  firstResponderAt: number | null;
  responderRequested: boolean;
  lastNoteAt: number | null;
  severity: IncidentSeverity;
  resolveAt: number | null;
  autoHealAt: number | null;
  autoHealScheduled: boolean;
  observabilitySource: string;
  failureId: string | null;
  failureSummary: string | null;
  noteContext: string[];
  syncedFromPd: boolean;
  isMajor?: boolean; // New v1.8
  prioritySet?: boolean; // New v1.8 to track if priority update was sent
}

export interface Metrics {
  avgMtta: SeverityMetrics; // milliseconds
  avgMttr: SeverityMetrics; // milliseconds
  apiRpm: number;
  apiCallsLast60s: number;
  droppedEvents: number;
}

export interface Service {
  id: string;
  name: string;
  logicalServiceName?: string; // Optional logical service name used for mapping profiles
  html_url?: string;
  teams: { id: string; name: string; persona?: string }[]; // Updated: include persona
  changeIntegrations: any[];
  include: boolean;
}

export interface SeverityConfig {
  minAckSec: number;
  maxAckSec: number;
  minResolveSec: number;
  maxResolveSec: number;
  noteProbability: number;
  responderProbability: number;
}

export interface SeverityConfigMap {
  info: SeverityConfig;
  warning: SeverityConfig;
  error: SeverityConfig;
  critical: SeverityConfig;
}

export const DEFAULT_AUTO_HEAL_CONFIG = {
  enabled: true,
  warningProbability: 0.2,
  minDelaySec: 30,
  maxDelaySec: 90,
};

export const DEFAULT_SEVERITY_CONFIGS: SeverityConfigMap = {
  info: { // Info is suppressed, but included for completeness
    minAckSec: 0, maxAckSec: 0,
    minResolveSec: 0, maxResolveSec: 0,
    noteProbability: 0, responderProbability: 0,
  },
  warning: {
    minAckSec: 30, maxAckSec: 120,
    minResolveSec: 90, maxResolveSec: 240,
    noteProbability: 0.2, responderProbability: 0.1,
  },
  error: {
    minAckSec: 15, maxAckSec: 90,
    minResolveSec: 60, maxResolveSec: 180,
    noteProbability: 0.3, responderProbability: 0.2,
  },
  critical: {
    minAckSec: 5, maxAckSec: 60,
    minResolveSec: 30, maxResolveSec: 120,
    noteProbability: 0.4, responderProbability: 0.3,
  },
};

export interface SourceMix {
  cloudwatch: number;
  datadog: number;
  newrelic: number;
  splunk: number;
  fallback: number;
}

export const DEFAULT_SOURCE_MIX: SourceMix = {
  cloudwatch: 0.25,
  datadog: 0.25,
  newrelic: 0.25,
  splunk: 0.25,
  fallback: 0,
};

export interface SimulationCredentials {
  apiToken: string;
  fromEmail: string;
  globalRoutingKey: string;
  pdRegion?: string; // New: PagerDuty region (e.g., "US", "EU")
}

export interface SimulationLogEntry {
  ts: string;
  type: 'info' | 'warn' | 'error';
  msg: string;
}

export interface MonitorTrendPoint {
  ts: number;
  count: number;
}

export interface TrackInfo {
  id: string;
  type: 'background' | 'scenario';
  name?: string;
  status: 'running' | 'completed' | 'stopped';
}

export interface SimulationState {
  isRunning: boolean;
  activeIncidents: Incident[];
  totalEvents: number;
  log: SimulationLogEntry[];
  monitorTrend: MonitorTrendPoint[];
  metrics: Metrics;
  tracks: TrackInfo[]; // Added tracks info
  _mttaSums: SeverityMetrics;
  _mttaCounts: SeverityMetrics;
  _mttrSums: SeverityMetrics;
  _mttrCounts: SeverityMetrics;
  _apiCallTimestamps: number[];
  _lastRpmCheck: number;
  _lastPollCheck: number;
}

export function createEmptySeverityMetrics(): SeverityMetrics {
  return { global: 0, info: 0, warning: 0, error: 0, critical: 0 };
}

export interface SimulationConfig {
  ratePerMinute: number;
  severityWeights: SeverityWeights;
  autoHealConfig: { enabled: boolean; warningProbability: number; minDelaySec: number; maxDelaySec: number };
  resumeExistingEnabled: boolean;
  sourceMix: SourceMix;
  burstProbability: number;
  majorIncidentProbability: number;
  responderAckRate: number;
  teamFailureProbability: number; // New v1.8.1
  changeRoutingKey?: string; // New v1.8 for Major Incident changes
  severityConfigs: SeverityConfigMap;
  selectedServices: Service[]; // Backend needs full service objects to trigger
  selectedTeamIds: string[]; // New: Restrict personas to these teams
  mappingProfileId?: string | null; // v2.2: mapping profile applied at runtime
  goldenDemoId?: string; // Optional: track which Golden Demo initiated the run
  items?: any[]; // Optional: Golden Demo items to execute
}

// For Phase 4 - Narrative & Session UX (defining Beat now as it's part of GoldenDemo configJson)
export interface Beat {
  id: string;
  title: string;
  description: string;
  whatToShowInPagerDuty: string;
  whatToSay: string;
  approxTimingSec?: number;
}

// GoldenDemoConfig is the structure stored inside GoldenDemo.configJson
export interface GoldenDemoConfig {
  name: string;
  description: string;
  items: any[]; // CampaignItem[] - Loosely typed for now, can be more specific
  beats?: Beat[]; // Array of narrative beats
}

// Prisma Client already generates a type for GoldenDemo, but defining an interface
// here can sometimes be useful for explicit typing in frontend/shared contexts
// For server-side, using `import { GoldenDemo } from '@prisma/client';` is usually sufficient.
// However, for consistency and clear definition of its expected content,
// especially configJson's internal structure, defining it here helps.
export interface GoldenDemo {
  id: string;
  name: string;
  vertical: string;
  maturityLevel: string;
  narrative: string;
  configJson: GoldenDemoConfig; // Use the specific config structure
  personaNotes?: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}
