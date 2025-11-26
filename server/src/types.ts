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
