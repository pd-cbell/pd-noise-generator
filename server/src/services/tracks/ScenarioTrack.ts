import { SimulationTrack } from './SimulationTrack';
import { EventType } from '../MappingResolver';
import { TemplateParser } from '../../utils/TemplateParser';
import { resolveEventTarget } from '../MappingResolver';
import crypto from 'crypto';

export class ScenarioTrack extends SimulationTrack {
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
    this.status = 'running';
    if (this.config.items && Array.isArray(this.config.items) && this.config.items.length > 0) {
      this.scheduleItems(this.config.items);
    }
  }

  public stop(): void {
    this.status = 'stopped';
    this.clearTimers();
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
    items.forEach((item, idx) => {
      const delaySec = Math.max(0, Number(item.delaySeconds || item.offsetSeconds || 0));
      cumulativeMs += delaySec * 1000;
      const timer = setTimeout(() => {
        this.fireItem(item, idx).catch((err) => {
          this.addLog(`Scenario event failed: ${err.message}`, 'error');
        });
      }, cumulativeMs);
      this.timers.push(timer);
    });
    this.addLog(`Scheduled ${items.length} scenario items.`, 'info');
    if (items.length > 0 && this.onComplete) {
      const finalTimer = setTimeout(() => {
        this.onComplete?.();
      }, cumulativeMs + 250);
      this.timers.push(finalTimer);
    }
  }

  private async fireItem(item: any, index: number) {
    const logicalServiceName =
      item.logicalServiceName ||
      item.service ||
      item.serviceName ||
      item?.payload?.custom_details?.service_name ||
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

    let payload = TemplateParser.parseObject(item.payload || {});
    payload = normalizePayload(payload);
    if (!payload.custom_details) payload.custom_details = {};
    payload.custom_details.service_name =
      resolvedTarget.effectiveServiceName || payload.custom_details.service_name || logicalServiceName;

    if (type === 'change') {
      const routingKey =
        item.changeRoutingKey ||
        item.integrationKey ||
        resolvedTarget.effectiveChangeRoutingKey ||
        this.simulatorConfig.pdChangeEventsRoutingKey ||
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
      };
      
      await this.pdClient.triggerChangeEvent(body);
      this.addLog(`Scenario change sent for ${logicalServiceName}`, 'info');
      return;
    }

    // incident/alert/note/automation
    const routingKey =
      resolvedTarget.effectiveRoutingKey || this.credentials.globalRoutingKey;

    if (!routingKey) {
      this.addLog(`Skipped event for ${logicalServiceName}: missing routing key.`, 'warn');
      return;
    }

    if (!payload.severity) {
      payload.severity = 'error';
    }
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
    this.addLog(`Scenario event sent (${type}) ${logicalServiceName} dedup=${dedup}`, 'info');
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
