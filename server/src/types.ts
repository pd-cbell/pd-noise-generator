export type IncidentSeverity = 'info' | 'warning' | 'error' | 'critical';

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
}

export interface Metrics {
  avgMtta: Record<IncidentSeverity | 'global', number>; // milliseconds
  avgMttr: Record<IncidentSeverity | 'global', number>; // milliseconds
  apiRpm: number;
  apiCallsLast60s: number;
  droppedEvents: number;
}

export interface Service {
  id: string;
  name: string;
  html_url?: string;
  teams: { id: string; name: string }[];
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

export const DEFAULT_AUTO_HEAL_CONFIG = {
  enabled: true,
  warningProbability: 0.2,
  minDelaySec: 30,
  maxDelaySec: 90,
};

export const DEFAULT_SEVERITY_CONFIGS: Record<IncidentSeverity, SeverityConfig> = {
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

export interface SimulationConfig {
  ratePerMinute: number;
  severityWeights: { info: number; warning: number; error: number; critical: number };
  autoHealConfig: { enabled: boolean; warningProbability: number; minDelaySec: number; maxDelaySec: number };
  resumeExistingEnabled: boolean;
  sourceMix: Record<string, number>;
  burstProbability: number;
  severityConfigs: Record<IncidentSeverity, SeverityConfig>;
  selectedServices: Service[]; // Backend needs full service objects to trigger
}
