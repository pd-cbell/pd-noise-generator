import { SimulationTrack } from './SimulationTrack';
import { EventType } from '../MappingResolver';
import { TemplateParser } from '../../utils/TemplateParser';
import { resolveEventTarget } from '../MappingResolver';
import crypto from 'crypto';

export class ScenarioTrack extends SimulationTrack {
  private static readonly DEFAULT_REPEAT_INTERVAL_SECONDS = 30;
  public type: 'background' | 'scenario' = 'scenario';
  private timers: NodeJS.Timeout[] = [];
  private onEventSent?: (payload: {
    trackRunId?: string;
    eventId: string;
    type: EventType;
    logicalServiceName: string;
    effectiveServiceName?: string;
    dedupKey?: string | null;
    threadKey?: string;
    isSeed?: boolean;
    seedDedupKey?: string;
  }) => void;
  private onComplete?: () => void;
  private trackRunId?: string;
  private threadState: Map<string, { seedDedupKey?: string; sequence: number }> = new Map();

  constructor(
    id: string,
    config: any,
    credentials: any,
    io: any,
    options?: {
      trackRunId?: string;
      onEventSent?: ScenarioTrack['onEventSent'];
      onComplete?: () => void;
      callbacks?: {
        onApiCall?: () => void;
        onIncidentAcked?: (incident: any, ackedAt: number) => void;
        onIncidentResolved?: (incident: any, resolvedAt: number) => void;
        onDroppedEvent?: () => void;
      };
    }
  ) {
    super(id, config, credentials, io, options?.callbacks);
    this.trackRunId = options?.trackRunId;
    this.onEventSent = options?.onEventSent;
    this.onComplete = options?.onComplete;
  }

  public start(): void {
    if (this.status === 'running') return;

    this.clearTimers();
    this.threadState.clear();

    if (!this.config.items || !Array.isArray(this.config.items) || this.config.items.length === 0) {
      this.status = 'completed';
      this.addLog('Scenario track completed: no items to schedule.', 'info');
      this.onComplete?.();
      return;
    }

    this.status = 'running';
    this.addLog('Scenario track started', 'info');
    this.scheduleItems(this.config.items);
  }

  public stop(): void {
    if (this.status === 'stopped') return;

    this.status = 'stopped';
    this.clearTimers();
    this.addLog('Scenario track stopped', 'info');
  }

  public override getTrackInfo() {
      // Try to find a name for the demo
      // We might need to pass the name in the config or look it up.
      // For now, ID is a decent fallback.
      return {
          id: this.id,
          type: this.type,
          name: this.config.goldenDemoId || `Scenario ${this.id.substring(0, 8)}`, 
          status: this.status
      };
  }

  public async tick(): Promise<void> {
    // Scenario tracks are event-driven via timers, so tick might be empty 
    // or used for checking overall scenario health/timeout.
    // For now, we rely on setTimeout scheduled in start().
  }

  public injectItems(items: any[]) {
    this.scheduleItems(items);
  }

  private clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  private scheduleItems(items: any[]) {
    let cumulativeMs = 0;
    let maxScheduledMs = 0;
    items.forEach((item, idx) => {
      const delaySec = Math.max(0, Number(item.delaySeconds || item.offsetSeconds || 0));
      cumulativeMs += delaySec * 1000;
      const baseScheduledMs = cumulativeMs;

      // repeatCount is treated as total sends for backward compatibility.
      // repeatCount=1 -> one send (no repeats), repeatCount=3 -> one initial + two repeats.
      const totalSends = Math.max(1, Math.round(Number(item.repeatCount ?? 1)));
      const repeatIntervalSec = Math.max(
        1,
        Math.round(
          Number(item.repeatIntervalSeconds ?? item.repeatEverySeconds ?? ScenarioTrack.DEFAULT_REPEAT_INTERVAL_SECONDS)
        )
      );

      for (let emissionIndex = 0; emissionIndex < totalSends; emissionIndex++) {
        const scheduledMs = baseScheduledMs + emissionIndex * repeatIntervalSec * 1000;
        maxScheduledMs = Math.max(maxScheduledMs, scheduledMs);
        const timer = setTimeout(() => {
          if (this.status !== 'running') return;
          this.fireItem(item, idx, emissionIndex, totalSends).catch((err) => {
            this.addLog(`Scenario event failed: ${err.message}`, 'error');
          });
        }, scheduledMs);
        this.timers.push(timer);
      }
    });
    this.addLog(`Scheduled ${items.length} scenario items.`, 'info');
    if (items.length > 0 && this.onComplete) {
      const finalTimer = setTimeout(() => {
        if (this.status !== 'running') return;
        this.status = 'completed';
        this.clearTimers();
        this.addLog('Scenario track completed', 'info');
        this.onComplete?.();
      }, maxScheduledMs + 250);
      this.timers.push(finalTimer);
    }
  }

  private async fireItem(item: any, index: number, emissionIndex: number = 0, totalSends: number = 1) {
    if (this.status !== 'running') return;

    const normalizeServiceName = (name?: string) => {
      if (!name) return undefined;
      const trimmed = String(name).trim();
      if (!trimmed || trimmed.toLowerCase() === 'unknown service') return undefined;
      return trimmed;
    };
    const logicalServiceName =
      normalizeServiceName(item.logicalServiceName) ||
      normalizeServiceName(item.service) ||
      normalizeServiceName(item.serviceName) ||
      normalizeServiceName(item?.payload?.custom_details?.service_name) ||
      normalizeServiceName(item?.payload?.payload?.custom_details?.service_name) ||
      normalizeServiceName(item?.payload?.custom_details?.service) ||
      normalizeServiceName(item?.payload?.payload?.custom_details?.service) ||
      'Unknown Service';
    const type = (item.eventType || item.type || 'alert') as EventType;

    const resolvedTarget = resolveEventTarget(
      { logicalServiceName, type },
      this.mappingProfile,
      this.simulatorConfig
    );

    const normalizePayload = (raw: any) => {
      const next = { ...(raw || {}) };
      const nested = raw?.payload && typeof raw.payload === 'object' ? raw.payload : null;
      if (nested) {
        delete next.payload;
        next.custom_details = {
          ...(nested.custom_details || {}),
          ...(next.custom_details || {}),
        };
        Object.assign(next, nested);
      }
      if (next.details) {
        next.custom_details = { ...(next.details || {}), ...(next.custom_details || {}) };
        delete next.details;
      }
      if (!next.summary && next.description) {
        next.summary = next.description;
      }
      delete next.description;
      delete next.contexts;
      return next;
    };

    const rawPayload = TemplateParser.parseObject(item.payload || {});
    const payloadWithExtras = normalizePayload(rawPayload);
    const links = payloadWithExtras.links || rawPayload.links || item.links || [];
    const images = payloadWithExtras.images || rawPayload.images || item.images || [];
    const payload = payloadWithExtras;
    if (!payload.custom_details) payload.custom_details = {};
    payload.custom_details.service_name =
      resolvedTarget.effectiveServiceName || payload.custom_details.service_name || logicalServiceName;

    // For repeated sends, slightly fluctuate plain numeric custom details to mimic live drift.
    if (emissionIndex > 0 && payload.custom_details && typeof payload.custom_details === 'object') {
      const adjusted = { ...payload.custom_details };
      Object.entries(adjusted).forEach(([key, rawValue]) => {
        if (key === 'service_name') return;
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          const factor = 0.92 + Math.random() * 0.16; // +/-8%
          adjusted[key] = Math.max(0, Math.round(rawValue * factor));
          return;
        }
        if (typeof rawValue === 'string' && /^-?\d+(\.\d+)?$/.test(rawValue.trim())) {
          const parsed = Number(rawValue.trim());
          const factor = 0.92 + Math.random() * 0.16;
          adjusted[key] = String(Math.max(0, Math.round(parsed * factor)));
        }
      });
      payload.custom_details = adjusted;
    }

    if (type === 'change') {
      const routingKey =
        item.changeRoutingKey ||
        item.integrationKey ||
        resolvedTarget.effectiveChangeRoutingKey ||
        null;

      if (!routingKey) {
        this.addLog(`Skipped change event for ${logicalServiceName}: missing change routing key.`, 'warn');
        return;
      }
      if (!payload.summary || String(payload.summary).trim().length === 0) {
        payload.summary = item.summary || `Change event for ${logicalServiceName}`;
      }
      payload.timestamp = new Date().toISOString();
      const body = {
        routing_key: routingKey,
        payload: {
          ...payload,
          source: payload.source || 'pd-noise-simulator-scenario',
        },
        ...(links.length ? { links } : {}),
        ...(images.length ? { images } : {}),
      };
      
      await this.pdClient.triggerChangeEvent(body);
      const repeatSuffix = totalSends > 1 ? ` [${emissionIndex + 1}/${totalSends}]` : '';
      this.addLog(`Scenario change sent for ${logicalServiceName}${repeatSuffix}`, 'info');
      return;
    }

    // incident/alert/note/automation
    const routingKey =
      resolvedTarget.effectiveRoutingKey || this.credentials.globalRoutingKey;

    if (!routingKey) {
      this.addLog(`Skipped event for ${logicalServiceName}: missing routing key.`, 'warn');
      return;
    }

    const normalizeSeverity = (value: any): 'info' | 'warning' | 'error' | 'critical' | null => {
      if (!value || typeof value !== 'string') return null;
      const next = value.trim().toLowerCase();
      if (next === 'info' || next === 'warning' || next === 'error' || next === 'critical') return next;
      return null;
    };

    const itemSeverity = normalizeSeverity(item.severity);
    const payloadSeverity = normalizeSeverity(payload.severity);
    // Event-level severity from the scenario item takes precedence over payload JSON.
    payload.severity = itemSeverity || payloadSeverity || 'error';
    if (!payload.summary || String(payload.summary).trim().length === 0) {
      payload.summary = item.summary || item.stepName || `Event for ${logicalServiceName}`;
    }

    const eventId = item.id || item.stepName || item.summary || `evt-${index}`;
    const threadKey =
      item.threadKey ||
      eventId ||
      `${index}-${logicalServiceName}-${(item.summary || '').substring(0, 20)}`;

    const state = this.threadState.get(threadKey) || { seedDedupKey: undefined, sequence: 0 };
    const isIncidentType = type === 'incident' || type === 'alert';
    let dedupKey: string | null = null;
    let isSeed = false;

    if (isIncidentType) {
      if (!state.seedDedupKey) {
        dedupKey = `gd:${this.trackRunId || this.id}:${threadKey}:seed`;
        state.seedDedupKey = dedupKey;
        state.sequence = 0;
        isSeed = true;
      } else {
        state.sequence += 1;
        const rand = crypto.randomUUID().substring(0, 8);
        dedupKey = `gd:${this.trackRunId || this.id}:${threadKey}:${state.sequence}:${rand}`;
      }
      this.threadState.set(threadKey, state);
    } else {
      dedupKey = item.dedupKey || null;
    }

    const body = {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: dedupKey,
      payload: {
        ...payload,
        source: payload.source || 'pd-noise-simulator-scenario',
        component: payload.component || resolvedTarget.effectiveServiceName || logicalServiceName,
      },
    };

    const response = await this.pdClient.triggerEvent(body);
    const dedup = response?.dedup_key || dedupKey || 'unknown';
    const repeatSuffix = totalSends > 1 ? ` [${emissionIndex + 1}/${totalSends}]` : '';
    this.addLog(`Scenario event sent (${type}) ${logicalServiceName}${repeatSuffix} dedup=${dedup}`, 'info');
    this.onEventSent?.({
      trackRunId: this.trackRunId,
      eventId,
      type,
      logicalServiceName,
      effectiveServiceName: resolvedTarget.effectiveServiceName,
      dedupKey: dedup,
      threadKey,
      isSeed,
      seedDedupKey: state.seedDedupKey,
    });
    
    // Track incident if it's a trigger
    if (type === 'incident' || type === 'alert') {
        const now = Date.now();
        // Minimal incident tracking for scenario
        this.addIncident({
            dedupKey: dedup,
            serviceId: resolvedTarget.effectiveServiceId || 'unknown',
            serviceName: resolvedTarget.effectiveServiceName || logicalServiceName,
            startedAt: now,
            incidentId: null,
            mapAttempts: 0,
            nextEvalAt: now + 10000,
            ackAt: null,
            autoAckAt: null,
            acked: false,
            firstResponderAt: null,
            responderRequested: false,
            lastNoteAt: null,
            severity: payload.severity,
            resolveAt: null,
            autoHealAt: null,
            autoHealScheduled: false,
            observabilitySource: payload.source || 'unknown',
            failureId: null,
            failureSummary: null,
            noteContext: [],
            syncedFromPd: false,
            isMajor: false
        });
    }
  }
}
