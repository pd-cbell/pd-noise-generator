import { SimulationTrack } from './SimulationTrack';
import { Incident, IncidentSeverity, Service } from '../../types';
import { payloadGenerator } from '../../utils/payloads';
import { TemplateParser } from '../../utils/TemplateParser';
import { fakerService } from '../FakerService';
import { integrationService } from '../IntegrationService';
import { resolveEventTarget } from '../MappingResolver';
import crypto from 'crypto';

// Shared Helper Functions (Duplicated for now, should move to utils if shared)
function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type FailureContext = {
  id?: string;
  summary?: string;
  isMajor?: boolean;
  preGeneratedDedupKey?: string;
  preferredTemplateId?: string;
  preferredPriorityLabel?: string;
};

export class BackgroundTrack extends SimulationTrack {
  public type: 'background' | 'scenario' = 'background';
  private timer: NodeJS.Timeout | null = null;
  // Queues for batching API calls
  private pendingAcks: Set<string> = new Set<string>();
  private pendingResolves: Set<string> = new Set<string>();
  private priorities: { id: string; name: string }[] = [];
  private onCallCache = new Map<string, { emails: string[]; expires: number }>();
  private pendingMerges: { targetDedupKey: string; sourceDedupKeys: string[]; createdAt: number; note: string }[] = [];
  private _lastPollCheck: number = 0;

  // Track-specific metrics (optional, or rely on base class aggregation)
  private droppedEvents: number = 0;

  constructor(
    id: string,
    config: any,
    credentials: any,
    io: any,
    callbacks?: {
      onApiCall?: () => void;
      onIncidentAcked?: (incident: Incident, ackedAt: number) => void;
      onIncidentResolved?: (incident: Incident, resolvedAt: number) => void;
      onDroppedEvent?: () => void;
    }
  ) {
    super(id, config, credentials, io, callbacks);
  }

  public start(): void {
    // Background track logic is driven by the Session tick, 
    // but it might have internal state to reset.
    this.status = 'running';
    this.addLog('Background noise track started', 'info');
  }

  public stop(): void {
    this.status = 'stopped';
    this.addLog('Background noise track stopped', 'info');
  }

  public async tick(): Promise<void> {
    const now = Date.now();

    // --- State Sync (Polling) ---
    // Periodically check status of active incidents to handle external merges/resolves
    if (now - (this._lastPollCheck || 0) > 10000) {
        this._lastPollCheck = now;
        const checkList = this.activeIncidents.filter(i => i.incidentId).slice(0, 25); // Check max 25 at a time
        if (checkList.length > 0 && this.credentials.apiToken && this.credentials.fromEmail) {
             const ids = checkList.map(i => i.incidentId!);
             this.pdClient.getIncidentsByIds(ids).then((res: any) => {
                 if (res && res.incidents) {
                     // Only check for resolved status. Do NOT remove if missing from list (too aggressive/flaky).
                     res.incidents.forEach((pdInc:any) => {
                         if (pdInc.status === 'resolved') {
                             const local = this.activeIncidents.find(l => l.incidentId === pdInc.id);
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
                                  const localInc = this.activeIncidents.find(i => i.incidentId === pdInc.id);
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
                     const localInc = this.activeIncidents.find(i => i.incidentId === id);
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
    
    // --- Process Pending Merges ---
    this.pendingMerges = this.pendingMerges.filter(merge => {
        const now = Date.now();
        // Safety timeout (e.g., 2 minutes) - discard if never mapped
        if (now - merge.createdAt > 120000) return false;

        // Find Target Incident ID
        const targetInc = this.activeIncidents.find(i => i.dedupKey === merge.targetDedupKey);
        if (!targetInc || !targetInc.incidentId) return true; // Keep waiting

        // Check Source Incident IDs
        const sourceIds: string[] = [];
        let allSourcesFound = true;
        
        for (const sourceKey of merge.sourceDedupKeys) {
            const sourceInc = this.activeIncidents.find(i => i.dedupKey === sourceKey);
            if (sourceInc && sourceInc.incidentId) {
                sourceIds.push(sourceInc.incidentId);
            } else {
                if (now - merge.createdAt < 60000) {
                     allSourcesFound = false;
                     break;
                }
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
    const { ratePerMinute, selectedServices, teamFailureProbability } = this.config;
    // Ensure selectedServices exists and is not empty before generating
    if (!selectedServices || selectedServices.length === 0) return;

    const lambda = ratePerMinute / 60; 
    const probabilityOfIncident = 1 - Math.exp(-lambda); 

    // Team Failure Scenario Check
    const teamFailurePerMinute = Math.max(0, Math.min(teamFailureProbability ?? 0.01, 1));
    const teamFailurePerTick = 1 - Math.exp(-teamFailurePerMinute / 60); // normalize to 1-second ticks
    if (Math.random() < teamFailurePerTick) {
        this.triggerTeamFailureScenario();
    }

    if (Math.random() < probabilityOfIncident) {
      const service = randomFrom(selectedServices);
      await this.triggerIncident(service);
    }

    // --- Handle Active Incidents Lifecycle ---
    const incidentsToProcess = [...this.activeIncidents]; 
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
                this.droppedEvents++;
                this.onDroppedEvent?.();
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
          const rand = Math.random();
          let pLabel = 'P2';
          if (rand < 0.3) pLabel = 'P1';
          else if (rand > 0.8) pLabel = 'P3';

          const pId = await this.ensurePriorityId(pLabel);
          if (pId) {
              this.updateIncident(inc.dedupKey, { prioritySet: true }); 
              this.pdClient.updateIncidentPriority(inc.incidentId, pId)
                  .then(() => {
                      this.addLog(`Promoted ${inc.incidentId} to Major Priority (${pLabel})`, 'warn');
                  })
                  .catch(e => {
                      this.addLog(`Failed to set priority: ${e.message}`, 'error');
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
  }

  // Helper methods copied and adapted
  private async ensurePdUserId() {
      // Simple cache check? In base class?
      // For now, simple implementation
      try {
          const ids = await this.pdClient.getUserIdsByEmail([this.credentials.fromEmail]);
          if (ids[0]) return ids[0];
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
        const emails = await this.pdClient.getOnCallUsers(serviceId, this.config.selectedTeamIds);
        this.onCallCache.set(serviceId, { 
            emails, 
            expires: now + 5 * 60 * 1000 
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
      const match = this.priorities.find((p) => p.name.startsWith(labelPrefix));
      return match ? match.id : null;
  }

  async ackIncident(dedupKey: string) {
    const incident = this.activeIncidents.find(i => i.dedupKey === dedupKey);
    if (!incident || !incident.incidentId || incident.acked) return;

    const ackedAt = Date.now();
    this.updateIncident(dedupKey, { acked: true, ackAt: ackedAt });
    this.onIncidentAcked?.({ ...incident, ackAt: ackedAt }, ackedAt);
    
    const personaEmail = await this.getOnCallEmailForService(incident.serviceId);
    
    if (personaEmail) {
        try {
            await this.pdClient.manageIncident(incident.incidentId, 'acknowledge', personaEmail);
            this.addLog(`Acknowledged incident ${incident.incidentId} as ${personaEmail}`, 'info');
            return;
        } catch (e) {
            console.warn(`Failed to ack as ${personaEmail}, falling back to bot.`, e);
        }
    }

    this.addLog(`Acknowledged incident ${incident.incidentId}`, 'info');
    this.pendingAcks.add(incident.incidentId);
  }

  async resolveIncident(dedupKey: string) {
    const incident = this.activeIncidents.find(i => i.dedupKey === dedupKey);
    if (!incident || !incident.incidentId) return;

    const resolvedAt = Date.now();
    this.onIncidentResolved?.({ ...incident, resolveAt: resolvedAt }, resolvedAt);
    this.removeIncident(dedupKey);
    
    const personaEmail = await this.getOnCallEmailForService(incident.serviceId);

    if (personaEmail) {
        try {
            await this.pdClient.manageIncident(incident.incidentId, 'resolve', personaEmail);
            this.addLog(`Resolved incident ${incident.incidentId} as ${personaEmail}`, 'info');
            return;
        } catch (e) {
             console.warn(`Failed to resolve as ${personaEmail}, falling back.`, e);
        }
    }

    this.addLog(`Resolved incident ${incident.incidentId}`, 'info');
    this.pendingResolves.add(incident.incidentId);
  }

  private getLogicalServiceName(service: Service): string {
    const svc: any = service;
    return svc?.logicalServiceName || service.name || 'Unknown Service';
  }

  public async triggerIncident(service: Service, failureContext: FailureContext | null = null) {
    // console.log('BackgroundTrack: Triggering incident for', service.name);
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

    const parsedPayload = TemplateParser.parseObject(payload);

    const logicalServiceName = this.getLogicalServiceName(service);
    const resolvedTarget = resolveEventTarget(
      { logicalServiceName, type: 'incident' },
      this.mappingProfile,
      this.simulatorConfig
    );

    if (parsedPayload.custom_details) {
      parsedPayload.custom_details.service_name = resolvedTarget.effectiveServiceName || logicalServiceName;
    } else {
      parsedPayload.custom_details = { service_name: resolvedTarget.effectiveServiceName || logicalServiceName };
    }

    const isMajor = failureContext?.isMajor || false;

    const severity: IncidentSeverity = (() => {
      if (isMajor) return 'critical'; 

      const rand = Math.random();
      let cumulative = 0;
      for (const [sev, weight] of Object.entries(severityWeights)) {
        cumulative += weight;
        if (rand < cumulative) return sev as IncidentSeverity;
      }
      return 'info';
    })();

    if (severity === 'info') {
        // Skipping info alerts tracking
    }

    const dedupKey = failureContext?.preGeneratedDedupKey ?? (failureContext ? undefined : crypto.randomUUID()); 

    const routingKey = resolvedTarget.effectiveRoutingKey || globalRoutingKey;
    if (!routingKey) {
      this.addLog(`No routing key available for incident on ${logicalServiceName}; skipping send.`, 'warn');
      return;
    }

    const baseEventBody = {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: dedupKey,
      payload: {
        ...parsedPayload,
        severity,
        source: parsedPayload.source || 'pd-noise-simulator',
        component: parsedPayload.component || resolvedTarget.effectiveServiceName || logicalServiceName,
        custom_details: {
          ...parsedPayload.custom_details,
          generator: 'pd-noise-simulator',
          sim_is_major: isMajor
        }
      }
    };

    if (resolvedTarget.notes) {
      this.addLog(resolvedTarget.notes, 'info');
    }

    try {
      // this.incrementApiCount(); // Metric tracking handled by Session via event emission? 
      // For now, metrics are lost or need to be bubbled up.
      
      const response = await this.pdClient.triggerEvent(baseEventBody);
      let incidentDedupKey = response.dedup_key || dedupKey || 'unknown';

      const primaryTeam = service.teams?.[0]; 
      if (parsedPayload.slackMessageTemplate && primaryTeam && primaryTeam.persona) {
          const slackMessage = fakerService.getPersonaDrivenSlackMessage(
              parsedPayload.slackMessageTemplate, 
              primaryTeam.persona
          );
          integrationService.sendSlackMessage(slackMessage).catch(e =>
              this.addLog(`Failed to send persona-driven Slack message: ${e.message}`, 'warn')
          );
      }

      if (severity !== 'info') {
        const now = Date.now();
        const config = this.config.severityConfigs[severity];

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
          incidentId: null, 
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
        this.addLog(isMajor ? `MAJOR INCIDENT TRIGGERED for ${service.name}!` : `Triggered ${severity} incident for ${service.name}`, isMajor ? 'error' : 'info');
      
        if (isMajor) {
            this.triggerRelatedChangeEvents([service]);
        }
      }

      // Burst logic omitted for brevity in first pass, but should be here.
      // ... (Event Burst Logic)

    } catch (error: any) {
      this.addLog(`Failed to trigger incident: ${error.message}`, 'error');
    }
  }

  private async triggerRelatedChangeEvents(targetServices: Service[]) {
      const count = Math.min(targetServices.length, getRandomInt(1, 3));
      const selectedServices = targetServices.sort(() => 0.5 - Math.random()).slice(0, count);

      for (const service of selectedServices) {
          const logicalServiceName = this.getLogicalServiceName(service);

          let changeRoutingKeyCandidate = this.config.changeRoutingKey ?? this.simulatorConfig.pdChangeEventsRoutingKey ?? null;

          if (service.changeIntegrations && service.changeIntegrations.length > 0) {
              const integration = service.changeIntegrations.find((i: any) => i.integrationKey);
              if (integration) {
                  changeRoutingKeyCandidate = integration.integrationKey;
              }
          }

          const resolvedTarget = resolveEventTarget(
            { logicalServiceName, type: 'change' },
            this.mappingProfile,
            { ...this.simulatorConfig, pdChangeEventsRoutingKey: changeRoutingKeyCandidate }
          );

          const routingKey = resolvedTarget.effectiveChangeRoutingKey;

          if (!routingKey) {
              this.addLog(`Skipped change event for ${logicalServiceName}: No Change Integration Key found.`, 'warn');
              continue;
          }
          
          const effectiveServiceName = resolvedTarget.effectiveServiceName || logicalServiceName;

          const body = {
              routing_key: routingKey,
              payload: {
                  summary: `Recent Deploy: ${effectiveServiceName} v${getRandomInt(1,9)}.${getRandomInt(0,9)}`,
                  timestamp: new Date().toISOString(),
                  source: 'CI/CD Pipeline',
                  custom_details: {
                      service: effectiveServiceName,
                      build_id: getRandomInt(1000, 9999),
                      triggered_by: 'Major Incident Simulation'
                  }
              }
          };

          await new Promise(r => setTimeout(r, getRandomInt(500, 2000)));

          this.pdClient.triggerChangeEvent(body)
            .then(() => {
                this.addLog(`Sent related change event for ${effectiveServiceName}`, 'info');
            })
            .catch(e => this.addLog(`Failed change event for ${effectiveServiceName}: ${e.message}`, 'warn'));
      }
  }

  private async triggerTeamFailureScenario() {
      const { selectedServices } = this.config;
      if (!selectedServices || selectedServices.length === 0) return;
  
      const teamMap = new Map<string, { name: string, services: Service[] }>();
  
      selectedServices.forEach(svc => {
          svc.teams.forEach(team => {
              if (!teamMap.has(team.id)) {
                  teamMap.set(team.id, { name: team.name, services: [] });
              }
              teamMap.get(team.id)?.services.push(svc);
          });
      });
  
      const eligibleTeams = Array.from(teamMap.values()).filter(t => t.services.length >= 2);
      if (eligibleTeams.length === 0) return;
  
      const targetTeam = randomFrom(eligibleTeams);
      const failureId = crypto.randomUUID();
      
      const { majorIncidentProbability } = this.config;
      const isMajorScenario = Math.random() < (majorIncidentProbability ?? 0.2);

      this.addLog(`Started ${isMajorScenario ? 'MAJOR ' : ''}Team Failure Scenario for Team: ${targetTeam.name}`, isMajorScenario ? 'error' : 'warn');
  
      const count = Math.min(targetTeam.services.length, getRandomInt(3, 5));
      const targetServices = targetTeam.services.sort(() => 0.5 - Math.random()).slice(0, count);
  
      const incidentDedupKeys: string[] = [];
      
      targetServices.forEach((svc, idx) => {
          const dedupKey = crypto.randomUUID(); 
          incidentDedupKeys.push(dedupKey);
          
          const delay = idx * getRandomInt(2000, 5000);
          setTimeout(async () => {
               await this.triggerIncident(svc, { 
                   id: failureId, 
                   summary: `Team Failure: ${targetTeam.name} - Systematic Outage`,
                   isMajor: isMajorScenario,
                   preGeneratedDedupKey: dedupKey 
               });
          }, delay);
      });
      
      if (incidentDedupKeys.length > 1) {
          this.pendingMerges.push({
              targetDedupKey: incidentDedupKeys[0],
              sourceDedupKeys: incidentDedupKeys.slice(1),
              createdAt: Date.now(),
              note: `Intelligent Grouping: Merged ${incidentDedupKeys.length - 1} related incidents from Team Failure Scenario (${targetTeam.name}).`
          });
      }
  
      this.triggerRelatedChangeEvents(targetServices);
  }
}
