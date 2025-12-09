import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io'; // Import Socket.io Server type
import {
  Incident,
  SimulationConfig,
  IncidentSeverity,
  Service,
  DEFAULT_SEVERITY_CONFIGS,
  DEFAULT_SOURCE_MIX,
  SimulationState,
  createEmptySeverityMetrics,
  SimulationCredentials,
  SourceMix,
} from '../types';
import { PagerDutyClient } from './PagerDutyClient';
import { payloadGenerator, payloadRegistry } from '../utils/payloads';
import { TemplateParser } from '../utils/TemplateParser';
import { fakerService } from './FakerService';
import { integrationService } from './IntegrationService';
import { serverConfig } from '../config';

// --- Shared Helper Functions ---
function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TREND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type PdPriority = { id: string; name: string };
type GeneratedPayload = {
  summary?: string;
  source?: string;
  severity?: IncidentSeverity;
  component?: string;
  custom_details?: Record<string, unknown>;
  [key: string]: unknown;
};
type FailureContext = {
  id?: string;
  summary?: string;
  isMajor?: boolean;
  preGeneratedDedupKey?: string;
  preferredTemplateId?: string;
  preferredPriorityLabel?: string;
};

export class SimulationInstance {
  public userId: string;
  public config: SimulationConfig;
  public credentials: SimulationCredentials;
  public state: SimulationState;
  private timer: NodeJS.Timeout | null = null;
  private pdClient: PagerDutyClient;
  private io: SocketIOServer; // Socket.io server instance for emitting updates
  
  // Queues for batching API calls
  private pendingAcks: Set<string> = new Set<string>();
  private pendingResolves: Set<string> = new Set<string>();
  private priorities: PdPriority[] = []; // Cache for Priority IDs
  private onCallCache = new Map<string, { emails: string[]; expires: number }>();
  private pendingMerges: { targetDedupKey: string; sourceDedupKeys: string[]; createdAt: number; note: string }[] = [];

  constructor(userId: string, config: SimulationConfig, credentials: SimulationCredentials, io: SocketIOServer) {
    this.userId = userId;
    this.config = this.normalizeConfig(config);
    this.credentials = credentials;
    this.io = io;

    this.state = {
      isRunning: false,
      activeIncidents: [],
      totalEvents: 0,
      log: [],
      monitorTrend: [],
      metrics: {
        avgMtta: createEmptySeverityMetrics(),
        avgMttr: createEmptySeverityMetrics(),
        apiRpm: 0,
        apiCallsLast60s: 0,
        droppedEvents: 0,
      },
      _mttaSums: createEmptySeverityMetrics(),
      _mttaCounts: createEmptySeverityMetrics(),
      _mttrSums: createEmptySeverityMetrics(),
      _mttrCounts: createEmptySeverityMetrics(),
      _apiCallTimestamps: [],
      _lastRpmCheck: 0,
      _lastPollCheck: 0,
    };

    this.pdClient = new PagerDutyClient({
      apiToken: credentials.apiToken,
      fromEmail: credentials.fromEmail,
      apiBase: serverConfig.pdApiBase,
    });
    
    // Seed payload registry on creation
    payloadRegistry.list();
  }

  private normalizeSourceMix(sourceMix: SourceMix | Partial<SourceMix> | undefined): SourceMix {
    return { ...DEFAULT_SOURCE_MIX, ...(sourceMix || {}) };
  }

  private normalizeConfig(config: SimulationConfig): SimulationConfig {
    const filteredServices = (config.selectedServices || []).filter((svc) => svc.include);
    return {
      ...config,
      selectedServices: filteredServices,
      sourceMix: this.normalizeSourceMix(config.sourceMix),
      severityConfigs: {
        ...DEFAULT_SEVERITY_CONFIGS,
        ...(config.severityConfigs || {}),
      },
    };
  }

  updateCredentials(credentials: SimulationCredentials) {
    this.credentials = credentials;
    this.pdClient = new PagerDutyClient({
      apiToken: credentials.apiToken,
      fromEmail: credentials.fromEmail,
      apiBase: serverConfig.pdApiBase,
    });
    // this.addLog("Credentials updated.", 'info'); // Optional: log internally
  }

  updateConfig(config: SimulationConfig) {
    this.config = this.normalizeConfig(config);
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
    console.log('ServerSimulationEngine: Stopping simulation for user', this.userId);
    this.addLog("Simulation stopped", 'info');
    this.emitState();
  }

  // --- Actions that can be called from frontend (via socket) ---
  
  // v2.0: Director Mode Trigger
  public async triggerTemplate(template: { name: string, template: string, slackMessageTemplate?: string | null }, serviceId: string, integrationKey?: string | null) {
      console.log(`ServerSimulationEngine: Triggering template '${template.name}' for service ${serviceId}`);
      
      try {
          // 1. Render Payload with Faker (Fast & Dumb)
          const payload = fakerService.generatePayload(template.template) as GeneratedPayload;
          
          // 2. Determine Routing Key
          // Use Service-level Integration Key if provided, else Global Key
          const routingKey = integrationKey || this.credentials.globalRoutingKey;
          
          if (!routingKey) {
              throw new Error("No Integration Key available (Service or Global)");
          }

          // 3. Prepare PD Event
          const dedupKey = crypto.randomUUID();
          const body = {
              routing_key: routingKey,
              event_action: 'trigger',
              dedup_key: dedupKey,
              payload: {
                  summary: payload.summary || `Template: ${template.name}`,
                  source: payload.source || 'pd-noise-simulator-director',
                  severity: payload.severity || 'error',
                  component: payload.component || 'unknown',
                  custom_details: {
                      ...payload.custom_details,
                      generator: 'pd-noise-simulator-director',
                      template_name: template.name
                  }
              }
          };

          // 4. Send to PD
          this.incrementApiCount();
          await this.pdClient.triggerEvent(body);
          
          // 4b. Send ChatOps (Slack) Message
          if (template.slackMessageTemplate) {
              const slackMsg = fakerService.renderString(template.slackMessageTemplate);
              integrationService.sendSlackMessage(slackMsg).catch(e => 
                this.addLog(`Failed to send Slack message: ${e.message}`, 'warn')
              );
          }
          
          // 5. Track locally?
          // For Director Mode, we generally just want to fire. 
          // But if we want it in the list, we need an Incident object.
          // Let's add it to the list for visibility.
          const now = Date.now();
          const newIncident: Incident = {
              dedupKey,
              serviceId: serviceId,
              serviceName: 'Director Mode Service', // We assume the UI knows the name, or we fetch it. 
              // Optimization: We don't have the Service Name here easily unless we fetch. 
              // For speed, let's use a placeholder or pass it in.
              startedAt: now,
              incidentId: null,
              mapAttempts: 0,
              nextEvalAt: now + 10000,
              ackAt: null,
              autoAckAt: null, // Manual only?
              acked: false,
              firstResponderAt: null,
              responderRequested: false,
              lastNoteAt: null,
              severity: payload.severity || 'error',
              resolveAt: null, // No auto-resolve for manual triggers?
              autoHealAt: null,
              autoHealScheduled: false,
              observabilitySource: payload.source || 'unknown',
              failureId: null,
              failureSummary: null,
              noteContext: [],
              syncedFromPd: false,
              isMajor: false
          };
          this.addIncident(newIncident);
          this.state.totalEvents++;
          this.addLog(`Director Mode: Triggered '${template.name}'`, 'info');
          this.emitState();

      } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          console.error("Full Trigger Error:", e);
          this.addLog(`Director Trigger Failed: ${message}`, 'error');
          throw e; // Re-throw to API
      }
  }

  async ackIncident(dedupKey: string) {
    const incident = this.state.activeIncidents.find(i => i.dedupKey === dedupKey);
    if (!incident || !incident.incidentId || incident.acked) return;

    // Optimistic update
    this.updateIncident(dedupKey, { acked: true, ackAt: Date.now() });
    const timeToAck = Date.now() - incident.startedAt;
    this.updateMetricsOnAck(incident.severity, timeToAck);
    
    // Try to use Realistic Persona
    const personaEmail = await this.getOnCallEmailForService(incident.serviceId);
    
    if (personaEmail) {
        try {
            await this.pdClient.manageIncident(incident.incidentId, 'acknowledge', personaEmail);
            this.addLog(`Acknowledged incident ${incident.incidentId} as ${personaEmail}`, 'info');
            this.emitState();
            return; // Skip batch queue if successful
        } catch (e) {
            // If failed (e.g. permission denied), fall back to batch/bot
            console.warn(`Failed to ack as ${personaEmail}, falling back to bot.`, e);
        }
    }

    this.addLog(`Acknowledged incident ${incident.incidentId}`, 'info');
    
    // Queue for batch processing
    this.pendingAcks.add(incident.incidentId);
    
    this.emitState();
  }

  async resolveIncident(dedupKey: string) {
    const incident = this.state.activeIncidents.find(i => i.dedupKey === dedupKey);
    if (!incident || !incident.incidentId) return;

    // Optimistic update
    const timeToResolve = Date.now() - incident.startedAt;
    this.updateMetricsOnResolve(incident.severity, timeToResolve);
    this.removeIncident(dedupKey);
    
    // Try to use Realistic Persona
    const personaEmail = await this.getOnCallEmailForService(incident.serviceId);

    if (personaEmail) {
        try {
            await this.pdClient.manageIncident(incident.incidentId, 'resolve', personaEmail);
            this.addLog(`Resolved incident ${incident.incidentId} as ${personaEmail}`, 'info');
            this.emitState();
            return; // Skip batch queue
        } catch (e) {
             console.warn(`Failed to resolve as ${personaEmail}, falling back.`, e);
        }
    }

    this.addLog(`Resolved incident ${incident.incidentId}`, 'info');

    // Queue for batch processing
    this.pendingResolves.add(incident.incidentId);

    this.emitState();
  }

  clearActiveIncidents() {
    this.state.activeIncidents = [];
    this.addLog("Cleared active incidents list locally", 'info');
    this.emitState();
  }

  async resolveAllIncidents() {
    this.addLog(`Resolving all ${this.state.activeIncidents.length} active incidents (Server-side)...`, 'info');
    
    // Queue all for resolution
    this.state.activeIncidents.forEach(inc => {
        if (inc.incidentId) {
            this.pendingResolves.add(inc.incidentId);
        } else {
            // If no incident ID yet, resolve via Events API using dedupKey
            const body = {
                routing_key: this.credentials.globalRoutingKey,
                event_action: 'resolve',
                dedup_key: inc.dedupKey,
                payload: {
                    summary: 'Resolve All (Simulator)',
                    source: 'pd-noise-simulator',
                    severity: 'info'
                }
            };
            this.pdClient.triggerEvent(body).catch(() => {});
        }
    });
    // Clear local list immediately
    this.state.activeIncidents = [];
    this.emitState();
  }

  // --- Internal State Management ---
  public addLog(msg: string, type: 'info' | 'warn' | 'error' = 'info') {
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

  private addMonitorTrendData(count: number) {
    const nowTs = Date.now();
    const windowStart = nowTs - TREND_WINDOW_MS;
    this.state.monitorTrend = this.state.monitorTrend.filter((point) => point.ts >= windowStart);
    this.state.monitorTrend.push({ ts: nowTs, count });
  }

  // --- Core Tick Logic ---
  private async tick() {
    if (!this.state.isRunning) return;

    // Update Trend Data
    this.addMonitorTrendData(this.state.activeIncidents.length);

    const now = Date.now();
    this.updateApiMetrics(); 

    // --- State Sync (Polling) ---
    // Periodically check status of active incidents to handle external merges/resolves
    if (now - (this.state._lastPollCheck || 0) > 10000) {
        this.state._lastPollCheck = now;
        const checkList = this.state.activeIncidents.filter(i => i.incidentId).slice(0, 25); // Check max 25 at a time
        if (checkList.length > 0) {
             const ids = checkList.map(i => i.incidentId!);
             this.pdClient.getIncidentsByIds(ids).then((res: any) => {
                 if (res && res.incidents) {
                     // Only check for resolved status. Do NOT remove if missing from list (too aggressive/flaky).
                     res.incidents.forEach((pdInc:any) => {
                         if (pdInc.status === 'resolved') {
                             const local = this.state.activeIncidents.find(l => l.incidentId === pdInc.id);
                             if (local) {
                                 this.removeIncident(local.dedupKey);
                                 this.addLog(`Incident ${pdInc.id} resolved externally. Syncing removal.`, 'info');
                             }
                         }
                     });
                 }
             }).catch(e => console.error("State Sync Poll failed:", e));
        }
    }

    // --- Batch Processing ---
    if (this.pendingAcks.size > 0) {
        const ids = Array.from(this.pendingAcks);
        this.pendingAcks.clear();
        try {
            const results = await this.pdClient.manageIncidentsBatch(ids, 'acknowledge');
            if (results && Array.isArray(results)) {
                results.forEach((res: any) => {
                    if (res && res.incidents) {
                        res.incidents.forEach((pdInc: any) => {
                             if (pdInc.status === 'resolved') {
                                  const localInc = this.state.activeIncidents.find(i => i.incidentId === pdInc.id);
                                  if (localInc) {
                                      this.removeIncident(localInc.dedupKey);
                                      this.addLog(`Incident ${pdInc.id} was resolved externally. Removed.`, 'info');
                                  }
                             }
                        });
                    }
                });
            }
        } catch (e: any) {
             this.addLog(`Batch Ack failed: ${e.message}`, 'error');
             if (e.message.includes('404') || e.message.includes('400') || e.message.toLowerCase().includes('not found')) {
                 ids.forEach(id => {
                     const localInc = this.state.activeIncidents.find(i => i.incidentId === id);
                     if (localInc) {
                         this.removeIncident(localInc.dedupKey);
                     }
                 });
                 this.addLog(`Removed ${ids.length} incidents due to API error (Batch Ack Failed)`, 'warn');
             }
        }
    }

    if (this.pendingResolves.size > 0) {
        const ids = Array.from(this.pendingResolves);
        this.pendingResolves.clear();
        try {
            await this.pdClient.manageIncidentsBatch(ids, 'resolve');
        } catch (e: any) {
             this.addLog(`Batch Resolve failed: ${e.message}`, 'error');
        }
    }
    
    // --- Process Pending Merges (v1.8.2) ---
    this.pendingMerges = this.pendingMerges.filter(merge => {
        const now = Date.now();
        // Safety timeout (e.g., 2 minutes) - discard if never mapped
        if (now - merge.createdAt > 120000) return false;

        // Find Target Incident ID
        const targetInc = this.state.activeIncidents.find(i => i.dedupKey === merge.targetDedupKey);
        if (!targetInc || !targetInc.incidentId) return true; // Keep waiting

        // Check Source Incident IDs
        const sourceIds: string[] = [];
        let allSourcesFound = true;
        
        for (const sourceKey of merge.sourceDedupKeys) {
            const sourceInc = this.state.activeIncidents.find(i => i.dedupKey === sourceKey);
            if (sourceInc && sourceInc.incidentId) {
                sourceIds.push(sourceInc.incidentId);
            } else {
                // If source incident is gone (e.g. resolved externally), we can't merge it. 
                // But we should wait a bit more if it just hasn't been created/mapped yet.
                // If 60s passed, maybe we just merge what we have?
                if (now - merge.createdAt < 60000) {
                     allSourcesFound = false;
                     break;
                }
                // If > 60s, proceed with partial merge (skipping missing source)
            }
        }

        if (!allSourcesFound) return true; // Keep waiting

        if (sourceIds.length === 0) return false; // Nothing to merge (sources missing)

        // Execute Merge
        this.pdClient.mergeIncidents(targetInc.incidentId, sourceIds)
            .then(() => {
                this.addLog(`Merged ${sourceIds.length} incidents into ${targetInc.incidentId} (Team Failure Grouping)`, 'info');
                this.pdClient.addNote(targetInc.incidentId!, merge.note).catch(() => {});
                
                // Remove merged source incidents from local state
                merge.sourceDedupKeys.forEach(key => this.removeIncident(key));
            })
            .catch(e => {
                this.addLog(`Merge failed: ${e.message}`, 'error');
            });
        
        return false; // Remove from queue
    });

    // --- Incident Generation (Poisson process) ---
    const { ratePerMinute, selectedServices, severityWeights, burstProbability, teamFailureProbability } = this.config;
    const lambda = ratePerMinute / 60; 
    const probabilityOfIncident = 1 - Math.exp(-lambda); 

    // Team Failure Scenario Check (v1.8.1)
    if (Math.random() < (teamFailureProbability ?? 0.01)) {
        this.triggerTeamFailureScenario();
    }

    if (Math.random() < probabilityOfIncident && selectedServices.length > 0) {
      const service = randomFrom(selectedServices);
      await this.triggerIncident(service);
    }

    // --- Handle Active Incidents Lifecycle ---
    const incidentsToProcess = [...this.state.activeIncidents]; 
    for (const inc of incidentsToProcess) {
      if (!inc.incidentId) {
        // Incident ID Mapping (Retry Logic)
        const nowMs = Date.now();
        const shouldRetryMapping =
          (inc.mapAttempts === 0 && nowMs - inc.startedAt > 10000) || 
          (inc.mapAttempts === 1 && inc.lastMapAttemptAt && nowMs - inc.lastMapAttemptAt > 30000); 
        
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
            this.addLog(`Mapping failed for ${inc.dedupKey.substring(0,8)}: ${e.message}`, 'warn');
          }
        }
        continue; 
      }

      const severityConfig = this.config.severityConfigs[inc.severity];
      if (!severityConfig) continue;

      // Auto-Resolve
      if (inc.resolveAt && now >= inc.resolveAt) {
        await this.resolveIncident(inc.dedupKey); 
        continue;
      }

      // Auto-Heal
      if (inc.autoHealScheduled && inc.autoHealAt && now >= inc.autoHealAt) {
        this.pdClient.addNote(inc.incidentId, "Auto-healed by simulator (Warning suppression)").catch(() => {});
        await this.resolveIncident(inc.dedupKey); 
        continue;
      }

      // Auto-Ack (Imperfect Responder)
      if (!inc.acked && inc.autoAckAt && now >= inc.autoAckAt) {
        const ackRate = this.config.responderAckRate ?? 0.9;
        if (Math.random() < ackRate) {
            await this.ackIncident(inc.dedupKey);
        } else {
            // Missed Ack
            this.addLog(`Responder missed Ack for ${inc.incidentId} (Simulated Fatigue). Escalating...`, 'warn');
            // Schedule secondary ack (Escalation simulation)
            this.updateIncident(inc.dedupKey, { autoAckAt: now + 300000 }); // Retry in 5 mins
        }
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

      // Major Incident Priority Promotion
      if (inc.isMajor && !inc.prioritySet && inc.incidentId) {
          // v1.8.2: Weighted Priority Distribution
          // P1: 30%, P2: 50%, P3: 20%
          const rand = Math.random();
          let pLabel = 'P2';
          if (rand < 0.3) pLabel = 'P1';
          else if (rand > 0.8) pLabel = 'P3';

          const pId = await this.ensurePriorityId(pLabel);
          if (pId) {
              // Optimistically set flag to prevent retry loop while waiting for promise
              this.updateIncident(inc.dedupKey, { prioritySet: true }); 
              this.pdClient.updateIncidentPriority(inc.incidentId, pId)
                  .then(() => {
                      this.addLog(`Promoted ${inc.incidentId} to Major Priority (${pLabel})`, 'warn');
                  })
                  .catch(e => {
                      this.addLog(`Failed to set priority: ${e.message}`, 'error');
                      // If failed, maybe reset flag? For now, let's assume manual intervention or it's fine.
                  });
          }
      }

      // Request Responder (Major Incident Swarming)
      if (inc.acked && !inc.responderRequested) {
        const prob = inc.isMajor ? 1.0 : severityConfig.responderProbability;
        
        if (Math.random() < prob) {
            this.updateIncident(inc.dedupKey, { responderRequested: true });
            const count = inc.isMajor ? 3 : 1; // Swarm if Major
            
            const userId = await this.ensurePdUserId();
            if (userId) {
                for(let i=0; i<count; i++) {
                    this.pdClient.requestResponder(inc.incidentId, userId, userId)
                        .then(() => this.addLog(`Requested responder ${i+1}/${count} for ${inc.incidentId}`, 'info'))
                        .catch(e => this.addLog(`Failed to request responder: ${e.message}`, 'error'));
                }
                if (inc.isMajor) {
                    this.pdClient.addNote(inc.incidentId, "MAJOR INCIDENT: War Room Established. Executive Stakeholders notified.").catch(()=>{});
                }
            } else {
                this.addLog(`Skipped responder request (User ID not found for ${this.credentials.fromEmail})`, 'warn');
            }
        }
      }
    }

    this.emitState();

    // Update Trend Data - moved to end to capture final state of this tick
    this.addMonitorTrendData(this.state.activeIncidents.length);
  }

  private pdUserId: string | null = null; // Cached PD User ID for the 'fromEmail'

  private async ensurePdUserId() {
      if (this.pdUserId) return this.pdUserId;
      try {
          const ids = await this.pdClient.getUserIdsByEmail([this.credentials.fromEmail]);
          if (ids[0]) {
              this.pdUserId = ids[0];
              return this.pdUserId;
          }
      } catch (e) {
          console.error("Failed to resolve PD User ID:", e);
      }
      return null;
  }

  private async getOnCallEmailForService(serviceId: string): Promise<string | null> {
    const now = Date.now();
    const cached = this.onCallCache.get(serviceId);
    if (cached && cached.expires > now) {
        return cached.emails.length > 0 ? randomFrom(cached.emails) : null;
    }

    try {
        // Pass selectedTeamIds to filter on-calls (Persona Restriction)
        const emails = await this.pdClient.getOnCallUsers(serviceId, this.config.selectedTeamIds);
        this.onCallCache.set(serviceId, { 
            emails, 
            expires: now + 5 * 60 * 1000 // Cache for 5 minutes
        });
        return emails.length > 0 ? randomFrom(emails) : null;
    } catch (e) {
        console.error(`Failed to fetch on-calls for service ${serviceId}`, e);
        return null;
    }
  }

  private async ensurePriorityId(labelPrefix: string) {
      if (this.priorities.length === 0) {
          try {
              const res = await this.pdClient.getPriorities();
              if (res && res.priorities) {
                  this.priorities = res.priorities;
              }
          } catch (e) {
              return null;
          }
      }
      // Find priority starting with label (e.g. "P1")
      const match = this.priorities.find((p) => p.name.startsWith(labelPrefix));
      return match ? match.id : null;
  }

  // --- Incident Triggering Logic (Adapted from client/src/store/useStore.ts) ---
  public async triggerIncident(service: Service, failureContext: FailureContext | null = null) {
    console.log('ServerSimulationEngine: Attempting to trigger incident for service', service.name);
    const { globalRoutingKey } = this.credentials;
    const { severityWeights, burstProbability, majorIncidentProbability } = this.config;

    if (!globalRoutingKey) {
      this.addLog('Global Routing Key missing. Cannot trigger incident.', 'warn');
      return;
    }

    const { payload } = payloadGenerator.buildEvent({
      service,
      failure: failureContext,
      sourceMix: this.config.sourceMix,
    });

    // Dynamic Payload Processing
    const parsedPayload = TemplateParser.parseObject(payload);

    if (parsedPayload.custom_details) {
      parsedPayload.custom_details.service_name = service.name;
    } else {
      parsedPayload.custom_details = { service_name: service.name };
    }

    // Determine Severity & Major Status
    // v1.8.1 Change: Major incidents are now primarily driven by Team Failure Scenarios
    // failureContext.isMajor can be passed by triggerTeamFailureScenario
    const isMajor = failureContext?.isMajor || false;

    const severity: IncidentSeverity = (() => {
      if (isMajor) return 'critical'; // Major incidents are always critical

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

    const dedupKey = failureContext?.preGeneratedDedupKey ?? (failureContext ? undefined : crypto.randomUUID()); // Allow PD to assign when campaign context exists

    const baseEventBody = {
      routing_key: globalRoutingKey,
      event_action: 'trigger',
      dedup_key: dedupKey,
      payload: {
        ...parsedPayload,
        severity,
        source: parsedPayload.source || 'pd-noise-simulator',
        component: parsedPayload.component || service.name,
        custom_details: {
          ...parsedPayload.custom_details,
          generator: 'pd-noise-simulator',
          sim_is_major: isMajor
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

        // Major incidents take longer to resolve (2x - 5x)
        const resolveMult = isMajor ? (Math.random() * 3 + 2) : 1;

        const ackDelay = getRandomInt(config.minAckSec, config.maxAckSec) * 1000;
        const resolveDelay = (getRandomInt(config.minResolveSec, config.maxResolveSec) * 1000) * resolveMult;

        const shouldAutoHeal = !isMajor && severity === 'warning' && this.config.autoHealConfig.enabled && Math.random() < this.config.autoHealConfig.warningProbability;
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
          observabilitySource: parsedPayload.source || 'unknown',
          failureId: failureContext?.id || null,
          failureSummary: failureContext?.summary || null,
          noteContext: parsedPayload.noteTemplates || [],
          syncedFromPd: false,
          isMajor: isMajor
        };
        this.addIncident(newIncident);
        this.state.totalEvents++;
        this.addLog(isMajor ? `MAJOR INCIDENT TRIGGERED for ${service.name}!` : `Triggered ${severity} incident for ${service.name}`, isMajor ? 'error' : 'info');
      
        if (isMajor) {
            this.triggerRelatedChangeEvents([service]);
        }
      }

      // Event Burst Logic (Async & Random)
      // Major incidents are more likely to burst? Or we keep burst prob separate.
      // Let's keep it separate but maybe increase burst count for major?
      if (severity !== 'info' && (isMajor || Math.random() < burstProbability)) {
        const burstCount = isMajor ? getRandomInt(5, 10) : getRandomInt(2, 7);
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

  private async triggerRelatedChangeEvents(targetServices: Service[]) {
      // Pick 1-3 random services from the target list to fire change events on
      const count = Math.min(targetServices.length, getRandomInt(1, 3));
      const selectedServices = targetServices.sort(() => 0.5 - Math.random()).slice(0, count);

      for (const service of selectedServices) {
          // Determine Routing Key: Priority = Service Integration > Global Config
          let routingKey = this.config.changeRoutingKey;
          
          if (service.changeIntegrations && service.changeIntegrations.length > 0) {
              // Use the first available integration key
              // Frontend maps it to { integrationKey: ... }
              const integration = service.changeIntegrations.find((i: any) => i.integrationKey);
              if (integration) {
                  routingKey = integration.integrationKey;
              }
          }

          if (!routingKey) {
              this.addLog(`Skipped change event for ${service.name}: No Change Integration Key found.`, 'warn');
              continue;
          }
          
          const body = {
              routing_key: routingKey,
              payload: {
                  summary: `Recent Deploy: ${service.name} v${getRandomInt(1,9)}.${getRandomInt(0,9)}`,
                  timestamp: new Date().toISOString(),
                  source: 'CI/CD Pipeline',
                  custom_details: {
                      service: service.name,
                      build_id: getRandomInt(1000, 9999),
                      triggered_by: 'Major Incident Simulation'
                  }
              }
          };

          // Add random delay for realism
          await new Promise(r => setTimeout(r, getRandomInt(500, 2000)));

          this.pdClient.triggerChangeEvent(body)
            .then(() => {
                this.state.totalEvents++;
                this.addLog(`Sent related change event for ${service.name}`, 'info');
            })
            .catch(e => this.addLog(`Failed change event for ${service.name}: ${e.message}`, 'warn'));
      }
  }

  private async triggerTeamFailureScenario() {
      const { selectedServices } = this.config;
      if (!selectedServices || selectedServices.length === 0) return;
  
      // Group services by Team ID
      const teamMap = new Map<string, { name: string, services: Service[] }>();
  
      selectedServices.forEach(svc => {
          svc.teams.forEach(team => {
              if (!teamMap.has(team.id)) {
                  teamMap.set(team.id, { name: team.name, services: [] });
              }
              teamMap.get(team.id)?.services.push(svc);
          });
      });
  
      // Filter teams with enough services (at least 2 to make it a "team" failure)
      const eligibleTeams = Array.from(teamMap.values()).filter(t => t.services.length >= 2);
      if (eligibleTeams.length === 0) return;
  
      const targetTeam = randomFrom(eligibleTeams);
      const failureId = crypto.randomUUID();
      
      // Determine if this Team Failure is a "Major Incident" (P1/P2)
      const { majorIncidentProbability } = this.config;
      const isMajorScenario = Math.random() < (majorIncidentProbability ?? 0.2);

      this.addLog(`Started ${isMajorScenario ? 'MAJOR ' : ''}Team Failure Scenario for Team: ${targetTeam.name}`, isMajorScenario ? 'error' : 'warn');
  
      // Select 3-5 services (or max available)
      const count = Math.min(targetTeam.services.length, getRandomInt(3, 5));
      const targetServices = targetTeam.services.sort(() => 0.5 - Math.random()).slice(0, count);
  
      // Trigger Incidents
      const incidentDedupKeys: string[] = [];
      
      targetServices.forEach((svc, idx) => {
          const dedupKey = crypto.randomUUID(); // Generate upfront for tracking
          incidentDedupKeys.push(dedupKey);
          
          const delay = idx * getRandomInt(2000, 5000);
          setTimeout(async () => {
               // Pass dedupKey explicitly
               await this.triggerIncident(svc, { 
                   id: failureId, 
                   summary: `Team Failure: ${targetTeam.name} - Systematic Outage`,
                   isMajor: isMajorScenario,
                   preGeneratedDedupKey: dedupKey // Pass this down!
               });
          }, delay);
      });
      
      // Queue for merging (if > 1 incident)
      if (incidentDedupKeys.length > 1) {
          this.pendingMerges.push({
              targetDedupKey: incidentDedupKeys[0],
              sourceDedupKeys: incidentDedupKeys.slice(1),
              createdAt: Date.now(),
              note: `Intelligent Grouping: Merged ${incidentDedupKeys.length - 1} related incidents from Team Failure Scenario (${targetTeam.name}).`
          });
      }
  
      // Trigger Change Events
      // Pass the list of affected services so we can route changes correctly
      this.triggerRelatedChangeEvents(targetServices);
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

  createOrUpdate(userId: string, config: SimulationConfig, credentials: SimulationCredentials) {
    console.log(`SimulationManager: createOrUpdate for ${userId}`, { hasCreds: !!credentials, hasKey: !!credentials?.globalRoutingKey });
    let instance = this.instances.get(userId);
    if (instance) {
        instance.updateConfig(config); // Update config if already running
        instance.updateCredentials(credentials);
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
