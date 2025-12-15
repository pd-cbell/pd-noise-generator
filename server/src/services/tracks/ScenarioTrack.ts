import { SimulationTrack } from './SimulationTrack';
import { EventType } from '../MappingResolver';
import { TemplateParser } from '../../utils/TemplateParser';
import { resolveEventTarget } from '../MappingResolver';

export class ScenarioTrack extends SimulationTrack {
  public type: 'background' | 'scenario' = 'scenario';
  private timers: NodeJS.Timeout[] = [];

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
    items.forEach((item) => {
      const delaySec = Math.max(0, Number(item.delaySeconds || item.offsetSeconds || 0));
      cumulativeMs += delaySec * 1000;
      const timer = setTimeout(() => {
        this.fireItem(item).catch((err) => {
          this.addLog(`Scenario event failed: ${err.message}`, 'error');
        });
      }, cumulativeMs);
      this.timers.push(timer);
    });
    this.addLog(`Scheduled ${items.length} scenario items.`, 'info');
  }

  private async fireItem(item: any) {
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

    const payload = TemplateParser.parseObject(item.payload || {});
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

    const body = {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: item.dedupKey,
      payload: {
        ...payload,
        source: payload.source || 'pd-noise-simulator-scenario',
        component: payload.component || resolvedTarget.effectiveServiceName || logicalServiceName,
      },
    };

    const response = await this.pdClient.triggerEvent(body);
    const dedup = response?.dedup_key || item.dedupKey || 'unknown';
    this.addLog(`Scenario event sent (${type}) ${logicalServiceName} dedup=${dedup}`, 'info');
    
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