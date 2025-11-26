import { Server as SocketIOServer } from 'socket.io'; // Import Socket.io Server type
import {
  Incident, SimulationConfig, Metrics,
  IncidentSeverity, Service, SeverityConfig,
  DEFAULT_AUTO_HEAL_CONFIG, DEFAULT_SEVERITY_CONFIGS,
} from '../types';
import { PagerDutyClient } from './PagerDutyClient';
import { payloadGenerator, payloadRegistry } from '../utils/payloads';

// --- Shared Helper Functions ---
function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TREND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface SimulationState {
  isRunning: boolean;
  activeIncidents: Incident[];
  totalEvents: number;
  log: { ts: string; type: 'info' | 'warn' | 'error'; msg: string }[];
  monitorTrend: { ts: number; count: number }[];
  metrics: Metrics;

  // Internal Counters (not exposed to UI mostly)
  _mttaSums: Record<IncidentSeverity | 'global', number>;
  _mttaCounts: Record<IncidentSeverity | 'global', number>;
  _mttrSums: Record<IncidentSeverity | 'global', number>;
  _mttrCounts: Record<IncidentSeverity | 'global', number>;
  _apiCallTimestamps: number[];
  _lastRpmCheck: number;
}

export class SimulationInstance {
  public userId: string;
  public config: SimulationConfig;
  public credentials: { apiToken: string; fromEmail: string; globalRoutingKey: string };
  public state: SimulationState;
  private timer: NodeJS.Timeout | null = null;
  private pdClient: PagerDutyClient;
  private io: SocketIOServer; // Socket.io server instance for emitting updates

  constructor(userId: string, config: SimulationConfig, credentials: any, io: SocketIOServer) {
    this.userId = userId;
    this.config = config;
    this.credentials = credentials;
    this.io = io;

    this.state = {
      isRunning: false,
      activeIncidents: [],
      totalEvents: 0,
      log: [],
      monitorTrend: [],
      metrics: {
        avgMtta: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
        avgMttr: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
        apiRpm: 0,
        apiCallsLast60s: 0,
        droppedEvents: 0,
      },
      _mttaSums: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _mttaCounts: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _mttrSums: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _mttrCounts: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _apiCallTimestamps: [],
      _lastRpmCheck: 0,
    };

    this.pdClient = new PagerDutyClient({
      apiToken: credentials.apiToken,
      fromEmail: credentials.fromEmail,
      apiBase: process.env.PD_API_BASE,
    });
    
    // Seed payload registry on creation
    payloadRegistry.list();
  }

  start() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    console.log('ServerSimulationEngine: Starting simulation for user', this.userId);
    this.timer = setInterval(() => this.tick(), 1000);
    this.addLog("Simulation started (Headless Mode)", 'info');
    this.emitState();
  }

  stop() {
    this.state.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.addLog("Simulation stopped", 'info');
    this.emitState();
  }

  // --- Actions that can be called from frontend (via socket) ---
  async ackIncident(dedupKey: string) {
    const incident = this.state.activeIncidents.find(i => i.dedupKey === dedupKey);
    if (!incident || !incident.incidentId || incident.acked) return;

    try {
      await this.pdClient.manageIncident(incident.incidentId, 'acknowledge');
      this.updateIncident(dedupKey, { acked: true, ackAt: Date.now() });
      
      const timeToAck = Date.now() - incident.startedAt;
      this.updateMetricsOnAck(incident.severity, timeToAck);

      this.addLog(`Acknowledged incident ${incident.incidentId}`, 'info');
      this.emitState();
    } catch (e: any) {
      this.addLog(`Failed to ack incident ${incident.incidentId}: ${e.message}`, 'error');
    }
  }

  async resolveIncident(dedupKey: string) {
    const incident = this.state.activeIncidents.find(i => i.dedupKey === dedupKey);
    if (!incident || !incident.incidentId) return;

    try {
      await this.pdClient.manageIncident(incident.incidentId, 'resolve');
      
      const timeToResolve = Date.now() - incident.startedAt;
      this.updateMetricsOnResolve(incident.severity, timeToResolve);

      this.removeIncident(dedupKey);
      this.addLog(`Resolved incident ${incident.incidentId}`, 'info');
      this.emitState();
    } catch (e: any) {
      this.addLog(`Failed to resolve incident ${incident.incidentId}: ${e.message}`, 'error');
    }
  }

  clearActiveIncidents() {
    this.state.activeIncidents = [];
    this.addLog("Cleared active incidents list locally", 'info');
    this.emitState();
  }

  async resolveAllIncidents() {
    this.addLog(`Resolving all ${this.state.activeIncidents.length} active incidents (Server-side)...`, 'info');
    const incidentsToResolve = [...this.state.activeIncidents]; // Resolve a snapshot
    for (const inc of incidentsToResolve) {
      if (inc.incidentId) {
        await this.resolveIncident(inc.dedupKey);
      }
    }
    this.emitState();
  }

  // --- Internal State Management ---
  private addLog(msg: string, type: 'info' | 'warn' | 'error' = 'info') {
    this.state.log.unshift({ ts: new Date().toLocaleTimeString(), type, msg });
    if (this.state.log.length > 800) this.state.log.pop();
  }

  private addIncident(incident: Incident) {
    this.state.activeIncidents.unshift(incident);
  }

  private updateIncident(dedupKey: string, updates: Partial<Incident>) {
    this.state.activeIncidents = this.state.activeIncidents.map(inc =>
      inc.dedupKey === dedupKey ? { ...inc, ...updates } : inc
    );
  }

  private removeIncident(dedupKey: string) {
    this.state.activeIncidents = this.state.activeIncidents.filter(inc => inc.dedupKey !== dedupKey);
  }

  private updateMetricsOnAck(severity: IncidentSeverity, timeToAck: number) {
    // Update Global
    this.state._mttaCounts.global++;
    this.state._mttaSums.global += timeToAck;
    this.state.metrics.avgMtta.global = this.state._mttaSums.global / this.state._mttaCounts.global;

    // Update Severity
    this.state._mttaCounts[severity]++;
    this.state._mttaSums[severity] += timeToAck;
    this.state.metrics.avgMtta[severity] = this.state._mttaSums[severity] / this.state._mttaCounts[severity];
  }

  private updateMetricsOnResolve(severity: IncidentSeverity, timeToResolve: number) {
    // Update Global
    this.state._mttrCounts.global++;
    this.state._mttrSums.global += timeToResolve;
    this.state.metrics.avgMttr.global = this.state._mttrSums.global / this.state._mttrCounts.global;

    // Update Severity
    this.state._mttrCounts[severity]++;
    this.state._mttrSums[severity] += timeToResolve;
    this.state.metrics.avgMttr[severity] = this.state._mttrSums[severity] / this.state._mttrCounts[severity];
  }
  
  private incrementApiCount() {
    this.state._apiCallTimestamps.push(Date.now());
  }

  private updateApiMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.state._apiCallTimestamps = this.state._apiCallTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
    this.state.metrics.apiCallsLast60s = this.state._apiCallTimestamps.length;
    
    // Simple RPM calculation for the last 5 seconds (roughly)
    const fiveSecondsAgo = now - 5000;
    const callsInLast5s = this.state._apiCallTimestamps.filter(timestamp => timestamp > fiveSecondsAgo).length;
    this.state.metrics.apiRpm = callsInLast5s * (60 / 5); // Scale to RPM
  }

  // --- Core Tick Logic (Adapted from client/src/store/useStore.ts) ---
  private async tick() {
    if (!this.state.isRunning) return;

    const now = Date.now();
    this.updateApiMetrics(); // Update API metrics every tick

    // --- Incident Generation (Poisson process) ---
    const { ratePerMinute, selectedServices, severityWeights, burstProbability } = this.config;
    const lambda = ratePerMinute / 60; // Incidents per second
    const probabilityOfIncident = 1 - Math.exp(-lambda); // Poisson probability for 1 second

    if (Math.random() < probabilityOfIncident && selectedServices.length > 0) {
      const service = randomFrom(selectedServices);
      await this.triggerIncident(service);
    }

    // --- Handle Active Incidents Lifecycle ---
    const incidentsToProcess = [...this.state.activeIncidents]; // Operate on a copy
    for (const inc of incidentsToProcess) {
      if (!inc.incidentId) {
        // Attempt to map dedupKey to PagerDuty Incident ID
        const nowMs = Date.now();
        const shouldRetryMapping =
          (inc.mapAttempts === 0 && nowMs - inc.startedAt > 10000) || // Initial 10s wait
          (inc.mapAttempts === 1 && inc.lastMapAttemptAt && nowMs - inc.lastMapAttemptAt > 30000); // Second attempt after 30s
        
        if (shouldRetryMapping) {
          try {
            const response = await this.pdClient.getIncidentByDedupKey(inc.dedupKey);
            const match = response.incidents?.[0];

            if (match) {
              this.updateIncident(inc.dedupKey, { incidentId: match.id });
            } else {
              if (inc.mapAttempts === 0) {
                this.updateIncident(inc.dedupKey, { mapAttempts: 1, lastMapAttemptAt: nowMs });
              } else {
                this.removeIncident(inc.dedupKey);
                this.state.metrics.droppedEvents++;
                this.addLog(`Dropped incident ${inc.dedupKey.substring(0, 8)} (Suppressed/Grouped)`, 'warn');
              }
            }
          } catch (e: any) {
            // Log, but don't rethrow, retry later
            this.addLog(`Mapping failed for ${inc.dedupKey.substring(0,8)}: ${e.message}`, 'warn');
          }
        }
        continue; // Skip further processing if no incidentId yet
      }

      const severityConfig = this.config.severityConfigs[inc.severity];
      if (!severityConfig) continue;

      // Auto-Resolve
      if (inc.resolveAt && now >= inc.resolveAt) {
        await this.resolveIncident(inc.dedupKey);
        continue;
      }

      // Auto-Heal (Warnings only)
      if (inc.autoHealScheduled && inc.autoHealAt && now >= inc.autoHealAt) {
        await this.pdClient.addNote(inc.incidentId, "Auto-healed by simulator (Warning suppression)");
        await this.resolveIncident(inc.dedupKey); // Resolve via API
        continue;
      }

      // Auto-Ack
      if (!inc.acked && inc.autoAckAt && now >= inc.autoAckAt) {
        await this.ackIncident(inc.dedupKey);
      }

      // Add Notes
      if (inc.acked && (!inc.lastNoteAt || (now - inc.lastNoteAt > 30000)) && Math.random() < severityConfig.noteProbability) {
        const note = randomFrom(inc.noteContext) || "Investigating...";
        try {
          await this.pdClient.addNote(inc.incidentId, note);
          this.updateIncident(inc.dedupKey, { lastNoteAt: now });
          this.addLog(`Added note to ${inc.incidentId}: "${note}"`, 'info');
        } catch (e: any) {
          this.addLog(`Failed to add note to ${inc.incidentId}: ${e.message}`, 'error');
        }
      }

      // Request Responder
      if (inc.acked && !inc.responderRequested && Math.random() < severityConfig.responderProbability) {
        // This requires PD User API token to find user ID first.
        // For now, we'll skip actual responder requests on server side to simplify
        this.updateIncident(inc.dedupKey, { responderRequested: true });
        this.addLog(`Simulating responder request for ${inc.incidentId} (API call skipped)`, 'info');
      }
    }
    
    this.emitState(); // Emit state after every tick
  }

  // --- Incident Triggering Logic (Adapted from client/src/store/useStore.ts) ---
  public async triggerIncident(service: Service, failureContext: any = null) {
    console.log('ServerSimulationEngine: Attempting to trigger incident for service', service.name);
    const { globalRoutingKey } = this.credentials;
    const { severityWeights, burstProbability } = this.config;

    if (!globalRoutingKey) {
      this.addLog('Global Routing Key missing. Cannot trigger incident.', 'warn');
      return;
    }

    const { payload } = payloadGenerator.buildEvent({
      service,
      failure: failureContext,
      sourceMix: this.config.sourceMix,
    });

    if (payload.custom_details) {
      payload.custom_details.service_name = service.name;
    } else {
      payload.custom_details = { service_name: service.name };
    }

    const severity: IncidentSeverity = (() => {
      const rand = Math.random();
      let cumulative = 0;
      for (const [sev, weight] of Object.entries(severityWeights)) {
        cumulative += weight;
        if (rand < cumulative) return sev as IncidentSeverity;
      }
      return 'info';
    })();

    if (severity === 'info') {
      // Suppress info alerts from active tracking, but send them to PD
    }

    const dedupKey = failureContext ? undefined : crypto.randomUUID(); // Let PD assign for campaigns if desired, or generate

    const baseEventBody = {
      routing_key: globalRoutingKey,
      event_action: 'trigger',
      dedup_key: dedupKey,
      payload: {
        ...payload,
        severity,
        source: payload.source || 'pd-noise-simulator',
        component: payload.component || service.name,
        custom_details: {
          ...payload.custom_details,
          generator: 'pd-noise-simulator'
        }
      }
    };

    try {
      this.incrementApiCount();
      const response = await this.pdClient.triggerEvent(baseEventBody);
      let incidentDedupKey = response.dedup_key || dedupKey || 'unknown';

      if (severity !== 'info') {
        const now = Date.now();
        const config = this.config.severityConfigs[severity];

        const ackDelay = getRandomInt(config.minAckSec, config.maxAckSec) * 1000;
        const resolveDelay = getRandomInt(config.minResolveSec, config.maxResolveSec) * 1000;

        const shouldAutoHeal = severity === 'warning' && this.config.autoHealConfig.enabled && Math.random() < this.config.autoHealConfig.warningProbability;
        const autoHealDelay = shouldAutoHeal
          ? getRandomInt(this.config.autoHealConfig.minDelaySec, this.config.autoHealConfig.maxDelaySec) * 1000
          : null;

        const newIncident: Incident = {
          dedupKey: incidentDedupKey,
          serviceId: service.id,
          serviceName: service.name,
          startedAt: now,
          incidentId: null, // Will be mapped later
          mapAttempts: 0,
          nextEvalAt: now + 10000,
          ackAt: null,
          autoAckAt: now + ackDelay,
          acked: false,
          firstResponderAt: null,
          responderRequested: false,
          lastNoteAt: null,
          severity,
          resolveAt: now + resolveDelay,
          autoHealAt: autoHealDelay ? now + autoHealDelay : null,
          autoHealScheduled: shouldAutoHeal,
          observabilitySource: payload.source || 'unknown',
          failureId: failureContext?.id || null,
          failureSummary: failureContext?.summary || null,
          noteContext: payload.noteTemplates || [],
          syncedFromPd: false
        };
        this.addIncident(newIncident);
        this.state.totalEvents++;
        this.addLog(`Triggered ${severity} incident for ${service.name}`, 'info');
      }

      // Event Burst Logic (Async & Random)
      if (severity !== 'info' && Math.random() < burstProbability) {
        const burstCount = getRandomInt(2, 7);
        (async () => {
          for (let i = 1; i < burstCount; i++) {
            const intervalMs = getRandomInt(10, 40) * 1000;
            await new Promise(r => setTimeout(r, intervalMs));

            const currentIncidents = this.state.activeIncidents;
            if (!currentIncidents.some(inc => inc.dedupKey === incidentDedupKey)) {
              return;
            }

            const burstEventBody = {
              ...baseEventBody,
              dedup_key: incidentDedupKey,
              payload: {
                ...baseEventBody.payload,
                custom_details: {
                  ...baseEventBody.payload.custom_details,
                  burst_event_num: i + 1,
                }
              }
            };

            this.incrementApiCount();
            await this.pdClient.triggerEvent(burstEventBody).catch(e => this.addLog(`Burst event failed: ${e.message}`, 'error'));
            this.state.totalEvents++;
            this.addLog(`Sent burst event ${i + 1}/${burstCount} for ${incidentDedupKey.substring(0, 8)}`, 'info');
          }
        })();
      }

    } catch (error: any) {
      this.addLog(`Failed to trigger incident: ${error.message}`, 'error');
    }
  }

  private emitState() {
    const room = this.io.sockets.adapter.rooms.get(this.userId);
    console.log('Emitting tick to', this.userId, 'Clients:', room ? room.size : 0);
    this.io.to(this.userId).emit('sim_tick', this.state);
  }
}

export class SimulationManager {
  private instances = new Map<string, SimulationInstance>();
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  get(userId: string) {
    return this.instances.get(userId);
  }

  createOrUpdate(userId: string, config: SimulationConfig, credentials: any) {
    console.log(`SimulationManager: createOrUpdate for ${userId}`, { hasCreds: !!credentials, hasKey: !!credentials?.globalRoutingKey });
    let instance = this.instances.get(userId);
    if (instance) {
        instance.config = config; // Update config if already running
        instance.credentials = credentials; // Update credentials
    } else {
        instance = new SimulationInstance(userId, config, credentials, this.io);
        this.instances.set(userId, instance);
    }
    return instance;
  }
  
  delete(userId: string) {
      const instance = this.instances.get(userId);
      if (instance) instance.stop();
      this.instances.delete(userId);
  }
}
