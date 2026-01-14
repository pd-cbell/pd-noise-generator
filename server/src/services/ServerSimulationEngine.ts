import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io'; 
import {
  SimulationConfig,
  SimulationState,
  createEmptySeverityMetrics,
  SimulationCredentials,
  DEFAULT_SOURCE_MIX,
  DEFAULT_SEVERITY_CONFIGS,
  SourceMix,
  Incident,
  IncidentSeverity,
  TrackInfo,
} from '../types';
import { MappingProfileService } from './MappingProfileService';
import { PagerDutyClient } from './PagerDutyClient';
import { payloadRegistry } from '../utils/payloads';
import { serverConfig } from '../config';
import { SimulationTrack } from './tracks/SimulationTrack';
import { BackgroundTrack } from './tracks/BackgroundTrack';
import { ScenarioTrack } from './tracks/ScenarioTrack';
import { fakerService } from './FakerService';
import { integrationService } from './IntegrationService';

const mappingProfileService = new MappingProfileService();
const TREND_WINDOW_MS = 15 * 60 * 1000; 

export type TrackRunState = {
  trackRunId: string;
  goldenDemoId?: string;
  startedAt: number;
  finishedAt?: number;
  mappingProfileId?: string | null;
  sentEvents: Array<{
    id: string;
    type: string;
    logicalServiceName: string;
    effectiveServiceName?: string;
    dedupKey?: string | null;
    sentAt: number;
    status: 'sent' | 'error';
    error?: string;
  }>;
  incidentsByDedupKey: Record<string, {
    dedupKey: string;
    incidentId?: string;
    incidentNumber?: number;
    htmlUrl?: string;
    serviceName?: string;
    title?: string;
    status?: string;
    urgency?: string;
    createdAt?: string;
    lastUpdatedAt?: string;
    lastFetchedAt?: number;
    firstSeenAt?: number;
    ackedAt?: number;
    resolvedAt?: number;
  }>;
  lastPollAt?: number;
  isActive: boolean;
  errors?: string[];
};

type GeneratedPayload = {
  summary?: string;
  source?: string;
  severity?: IncidentSeverity;
  component?: string;
  custom_details?: Record<string, unknown>;
  [key: string]: unknown;
};

// --- SimulationSession (The Conductor) ---
export class SimulationSession {
  public userId: string;
  public config: SimulationConfig; // Global config (used for background track mostly)
  public credentials: SimulationCredentials;
  public state: SimulationState;
  
  private tracks: Map<string, SimulationTrack> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private io: SocketIOServer; 
  private pdClient: PagerDutyClient; // Still needed for some session-level ops or just passing to tracks
  private trackRuns: Map<string, TrackRunState> = new Map();
  private trackRunByTrackId: Map<string, string> = new Map();
  private metricIncidentState: Map<string, { acked: boolean; resolved: boolean }> = new Map();

  constructor(userId: string, config: SimulationConfig, credentials: SimulationCredentials, io: SocketIOServer) {
    this.userId = userId;
    this.config = this.normalizeConfig(config);
    this.credentials = credentials;
    this.io = io;

    // Initialize State
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
      tracks: [], // Initial empty tracks list
      _mttaSums: createEmptySeverityMetrics(),
      _mttaCounts: createEmptySeverityMetrics(),
      _mttrSums: createEmptySeverityMetrics(),
      _mttrCounts: createEmptySeverityMetrics(),
      _apiCallTimestamps: [],
      _lastRpmCheck: 0,
      _lastPollCheck: 0, // Legacy field, might be used by tracks internally
    };

    this.pdClient = new PagerDutyClient({
      apiToken: credentials.apiToken,
      fromEmail: credentials.fromEmail,
      pdRegion: credentials.pdRegion,
      apiBase: serverConfig.pdApiBase,
    });
    
    payloadRegistry.list();

    // Initialize Default Background Track
    this.createBackgroundTrack();
  }
  private emitTrackRunStarted(trackRunId: string, goldenDemoId?: string, mappingProfileId?: string | null) {
    const payload = {
      trackRunId,
      goldenDemoId: goldenDemoId || null,
      mappingProfileId: mappingProfileId || null,
      startedAt: Date.now(),
    };
    this.io.to(this.userId).emit('track_run_started', payload);
  }

  private emitTrackRunUpdate(run: TrackRunState) {
    this.io.to(this.userId).emit('track_run_update', run);
  }

  private emitTrackRunFinished(run: TrackRunState) {
    this.io.to(this.userId).emit('track_run_finished', run);
  }

  private initializeTrackRun(trackRunId: string, goldenDemoId?: string, mappingProfileId?: string | null) {
    const run: TrackRunState = {
      trackRunId,
      goldenDemoId,
      mappingProfileId: mappingProfileId || null,
      startedAt: Date.now(),
      sentEvents: [],
      incidentsByDedupKey: {},
      isActive: true,
      errors: [],
    };
    this.trackRuns.set(trackRunId, run);
  }

  private registerTrackEvent(
    trackRunId: string,
    payload: {
      eventId: string;
      type: string;
      logicalServiceName: string;
      effectiveServiceName?: string;
      dedupKey?: string | null;
      threadKey?: string;
      isSeed?: boolean;
      seedDedupKey?: string;
    }
  ) {
    const run = this.trackRuns.get(trackRunId);
    if (!run) return;
    const now = Date.now();
    run.sentEvents.push({
      id: payload.eventId,
      type: payload.type,
      logicalServiceName: payload.logicalServiceName,
      effectiveServiceName: payload.effectiveServiceName,
      dedupKey: payload.dedupKey,
      sentAt: now,
      status: 'sent',
    });

    if (payload.dedupKey) {
      if (payload.isSeed && (payload.type === 'incident' || payload.type === 'alert')) {
        if (!run.incidentsByDedupKey[payload.dedupKey]) {
          run.incidentsByDedupKey[payload.dedupKey] = {
            dedupKey: payload.dedupKey,
            serviceName: payload.effectiveServiceName || payload.logicalServiceName,
            firstSeenAt: now,
          };
        }
      }
    }
    this.emitTrackRunUpdate(run);
  }

  private finishTrackRun(trackRunId: string) {
    const run = this.trackRuns.get(trackRunId);
    if (!run) return;
    run.finishedAt = Date.now();
    const stillUnresolved = Object.values(run.incidentsByDedupKey || {}).some((i) => i.status !== 'resolved');
    run.isActive = false;
    this.emitTrackRunUpdate(run);
    if (!stillUnresolved) {
      this.emitTrackRunFinished(run);
    }
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

  private async createBackgroundTrack() {
    // If background track exists, update it? Or recreate?
    // For v2.3, we'll recreate or update. 
    // Let's check if it exists.
    let bgTrack = this.tracks.get('background') as BackgroundTrack;
    if (bgTrack) {
        // Update logic not fully implemented on Track yet, so we might just replace it 
        // if we want to support dynamic config updates.
        // Ideally, SimulationTrack should have an updateConfig method. 
        // For now, we assume this is called on init.
    } else {
        bgTrack = new BackgroundTrack('background', this.config, this.credentials, this.io, this.getMetricCallbacks());
        // Apply mapping profile if global config has one
        if (this.config.mappingProfileId) {
            const profile = await mappingProfileService.getMappingProfileById(
              this.config.mappingProfileId,
              this.userId
            );
            bgTrack.applyMappingProfile(profile);
        }
        this.tracks.set('background', bgTrack);
    }
  }

  public async updateConfig(config: SimulationConfig) {
    this.config = this.normalizeConfig(config);
    // Re-create or update background track
    // This is a bit heavy-handed but ensures config sync.
    // In future, pass updates to tracks.
    // Preserving state is tricky if we replace the object.
    // Better: Update the existing track's config property.
    const bgTrack = this.tracks.get('background') as BackgroundTrack;
    if (bgTrack) {
        // Hack: Direct property update. Should be a method.
        // We'll reimplement the track with new config but keep its state?
        // Or just let the track read from a shared config ref?
        // Tracks have their own copy. Let's just replace it for now to ensure settings apply.
        // BUT we lose active incidents. 
        // Let's create a new one but move state over? Too complex for now.
        // Let's just allow replacing the background track configuration effectively.
        // Since we are refactoring, let's just make sure BackgroundTrack uses THIS session's config?
        // No, it has its own.
        // We will simple replace the track instance for V2.3 MVP robustness.
        // Note: This resets background noise state. Acceptable for config changes.
        this.tracks.delete('background');
        await this.createBackgroundTrack();
    }
    
    // Apply mapping profile to all tracks? 
    // Usually scenario tracks have their own lifecycle.
  }

  public async updateCredentials(credentials: SimulationCredentials) {
      this.credentials = credentials;
      // Update all tracks?
      // For now, requires restart or tracks need update method.
      // Re-init background track
      this.tracks.delete('background');
      await this.createBackgroundTrack();
  }

  public start() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    
    console.log('SimulationSession: Starting for user', this.userId);
    this.timer = setInterval(() => this.tick(), 1000);
    this.addLog("Simulation Session Started", 'info');
    if (!this.credentials.globalRoutingKey) {
      console.warn('SimulationSession: Global routing key missing; alert events will not be sent.');
      this.addLog('Global routing key missing; alert events will not be sent.', 'warn');
    }
    if (!this.credentials.apiToken || !this.credentials.fromEmail) {
      console.warn('SimulationSession: PagerDuty REST credentials missing; lifecycle actions may fail.');
      this.addLog('PagerDuty REST credentials missing; lifecycle actions may fail.', 'warn');
    }
    if (!this.config.selectedServices || this.config.selectedServices.length === 0) {
      console.warn('SimulationSession: No services selected; background noise will not emit events.');
      this.addLog('No services selected; background noise will not emit events.', 'warn');
    }

    // Start all tracks
    this.tracks.forEach(track => track.start());
    
    this.emitState();
  }

  public stop() {
    this.state.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    
    console.log('SimulationSession: Stopping for user', this.userId);
    this.addLog("Simulation Session Stopped", 'info');

    // Stop all tracks
    this.tracks.forEach(track => track.stop());

    this.emitState();
  }

  // --- Track Management ---

  public async startTrack(type: 'background' | 'scenario', configOrItems: any, trackId?: string) {
      const id = trackId || crypto.randomUUID();
      
      let track: SimulationTrack;

      if (type === 'scenario') {
          // configOrItems is items array for scenario
          const scenarioConfig: SimulationConfig = {
              ...this.config, // Inherit base config
              items: configOrItems // Override items
          };
          const trackRunId = crypto.randomUUID();
          this.initializeTrackRun(trackRunId, scenarioConfig.goldenDemoId, scenarioConfig.mappingProfileId);
          track = new ScenarioTrack(id, scenarioConfig, this.credentials, this.io, {
            trackRunId,
            onEventSent: (payload) => this.registerTrackEvent(trackRunId, payload),
            onComplete: () => this.finishTrackRun(trackRunId),
            callbacks: this.getMetricCallbacks(),
          });
          this.trackRunByTrackId.set(id, trackRunId);
          this.emitTrackRunStarted(trackRunId, scenarioConfig.goldenDemoId, scenarioConfig.mappingProfileId);
      } else {
          // Background
          track = new BackgroundTrack(id, this.config, this.credentials, this.io, this.getMetricCallbacks());
      }

      // Apply mapping if provided in session config context (or passed in?)
      // For scenarios injected via Director, we usually have a profile ID.
      // We need to handle that. 
      // Current injectGoldenDemoItems passed mappingProfileId.
      
      this.tracks.set(id, track);
      if (this.state.isRunning) {
          track.start();
      }
      return track;
  }

  public stopTrack(trackId: string) {
      const track = this.tracks.get(trackId);
      if (track) {
          track.stop();
          this.tracks.delete(trackId);
          const runId = this.trackRunByTrackId.get(trackId);
          if (runId) {
            this.finishTrackRun(runId);
            this.trackRunByTrackId.delete(trackId);
          }
      }
  }

  // --- Legacy Interface Support (Bridging old calls to tracks) ---

  public async injectGoldenDemoItems(items: any[]) {
      // Create a new ScenarioTrack for these items
      const trackId = `demo-${crypto.randomUUID().substring(0,8)}`;
      const track = new ScenarioTrack(trackId, { ...this.config, items }, this.credentials, this.io);
      
      // Apply current session mapping profile by default?
      // The old logic applied it. 
      if (this.config.mappingProfileId) {
          const profile = await mappingProfileService.getMappingProfileById(
            this.config.mappingProfileId,
            this.userId
          );
          await track.applyMappingProfile(profile);
      }

      this.tracks.set(trackId, track);
      this.addLog(`Started Scenario Track: ${trackId}`, 'info');
      
      if (this.state.isRunning) {
          track.start();
      }
  }

  // Manually applying mapping profile to a specific new track (used by socket handler)
  public async applyMappingToNewTrack(track: SimulationTrack, mappingProfileId: string) {
      const profile = await mappingProfileService.getMappingProfileById(mappingProfileId, this.userId);
      await track.applyMappingProfile(profile);
  }

  // --- Actions ---

  public async triggerTemplate(template: { name: string, template: string, slackMessageTemplate?: string | null }, serviceId: string, integrationKey?: string | null) {
      console.log(`ServerSimulationEngine: Triggering template '${template.name}' for service ${serviceId}`);
      
      try {
          const payload = fakerService.generatePayload(template.template) as GeneratedPayload;
          
          const routingKey = integrationKey || this.credentials.globalRoutingKey;
          
          if (!routingKey) {
              throw new Error("No Integration Key available (Service or Global)");
          }

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

          this.pdClient.triggerEvent(body); // Fire and forget for speed
          
          // Actually, let's await it to return success to UI.
          // await this.pdClient.triggerEvent(body); 
          
          if (template.slackMessageTemplate) {
              const slackMsg = fakerService.renderString(template.slackMessageTemplate);
              integrationService.sendSlackMessage(slackMsg).catch(e => 
                this.addLog(`Failed to send Slack message: ${e.message}`, 'warn')
              );
          }
          
          const now = Date.now();
          const newIncident: Incident = {
              dedupKey,
              serviceId: serviceId,
              serviceName: 'Director Mode Service', 
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
              severity: payload.severity || 'error',
              resolveAt: null, 
              autoHealAt: null,
              autoHealScheduled: false,
              observabilitySource: payload.source || 'unknown',
              failureId: null,
              failureSummary: null,
              noteContext: [],
              syncedFromPd: false,
              isMajor: false
          };
          this.addIncident(newIncident); // Add to session state
          this.state.totalEvents++;
          this.addLog(`Director Mode: Triggered '${template.name}'`, 'info');
          this.emitState();

      } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          console.error("Full Trigger Error:", e);
          this.addLog(`Director Trigger Failed: ${message}`, 'error');
          throw e; 
      }
  }

  async ackIncident(dedupKey: string) {
      // Broadcast to all tracks? Or find owner?
      // Since tracks maintain their own activeIncidents, we can check which track owns it.
      // But incidents move fast.
      // For v2.3 MVP, we just iterate all.
      for (const track of this.tracks.values()) {
          // Cast to any because ackIncident isn't on base abstract class yet (it should be?)
          // We implemented it on BackgroundTrack. ScenarioTrack doesn't have lifecycle logic yet.
          if (track instanceof BackgroundTrack) {
              await track.ackIncident(dedupKey);
          }
      }
      // Also update local state for immediate feedback
      this.updateIncident(dedupKey, { acked: true, ackAt: Date.now() });
      this.emitState();
  }

  async resolveIncident(dedupKey: string) {
      for (const track of this.tracks.values()) {
          if (track instanceof BackgroundTrack) {
              await track.resolveIncident(dedupKey);
          }
      }
      this.removeIncident(dedupKey);
      this.emitState();
  }

  clearActiveIncidents() {
      // Clear all tracks
      this.tracks.forEach(t => t.activeIncidents = []);
      this.state.activeIncidents = [];
      this.addLog("Cleared active incidents locally", 'info');
      this.emitState();
  }

  async resolveAllIncidents() {
      // This is complex distributed. 
      // Simple approach: Trigger resolve event for all currently known incidents in session state.
      this.state.activeIncidents.forEach(inc => {
           this.pdClient.triggerEvent({
               routing_key: this.credentials.globalRoutingKey, // Fallback, might be wrong for specific services
               event_action: 'resolve',
               dedup_key: inc.dedupKey,
               payload: { summary: 'Resolve All', source: 'pd-noise-simulator', severity: 'info' }
           }).catch(()=>{});
      });
      this.clearActiveIncidents();
  }

  // --- Aggregation & Tick ---

  private addLog(msg: string, type: 'info' | 'warn' | 'error' = 'info') {
    this.state.log.unshift({ ts: new Date().toLocaleTimeString(), type, msg });
    if (this.state.log.length > 800) this.state.log.pop();
  }

  private addIncident(incident: Incident) {
    this.state.activeIncidents.unshift(incident);
  }

  private updateIncident(dedupKey: string, updates: Partial<Incident>) {
      // Update local view
      this.state.activeIncidents = this.state.activeIncidents.map(inc =>
        inc.dedupKey === dedupKey ? { ...inc, ...updates } : inc
      );
  }

  private removeIncident(dedupKey: string) {
      this.state.activeIncidents = this.state.activeIncidents.filter(inc => inc.dedupKey !== dedupKey);
  }

  private addMonitorTrendData(count: number) {
    const nowTs = Date.now();
    const windowStart = nowTs - TREND_WINDOW_MS;
    this.state.monitorTrend = this.state.monitorTrend.filter((point) => point.ts >= windowStart);
    this.state.monitorTrend.push({ ts: nowTs, count });
  }

  private async tick() {
      if (!this.state.isRunning) return;

      // 1. Tick all tracks
      for (const track of this.tracks.values()) {
          await track.tick();
      }

      // 2. Aggregate State
      // Merge logs and incidents from all tracks
      let allIncidents: Incident[] = [];
      let trackInfos: TrackInfo[] = [];

      this.tracks.forEach(track => {
          allIncidents = [...allIncidents, ...track.activeIncidents];
          trackInfos.push(track.getTrackInfo());
          const drainedLogs = track.drainLogs();
          if (drainedLogs.length > 0) {
            const trackLabel = track.type === 'background' ? 'Background' : 'Scenario';
            drainedLogs.forEach((entry) => {
              this.state.log.unshift({
                ts: entry.ts,
                type: entry.type,
                msg: `[${trackLabel}] ${entry.msg}`,
              });
            });
            if (this.state.log.length > 800) {
              this.state.log.length = 800;
            }
          }
      });

      // Sort by start time descending
      allIncidents.sort((a, b) => b.startedAt - a.startedAt);
      this.state.activeIncidents = allIncidents;
      this.state.tracks = trackInfos;

      // Update Trend
      this.addMonitorTrendData(this.state.activeIncidents.length);

      this.refreshApiMetrics();
      await this.pollTrackRuns();

      this.emitState();
  }

  private getMetricCallbacks() {
    return {
      onApiCall: () => this.recordApiCall(),
      onIncidentAcked: (incident: Incident, ackedAt: number) => this.recordAck(incident, ackedAt),
      onIncidentResolved: (incident: Incident, resolvedAt: number) => this.recordResolve(incident, resolvedAt),
      onDroppedEvent: () => this.recordDrop(),
    };
  }

  private recordApiCall() {
    this.state._apiCallTimestamps.push(Date.now());
  }

  private refreshApiMetrics() {
    const now = Date.now();
    this.state._apiCallTimestamps = this.state._apiCallTimestamps.filter((t) => now - t <= 60000);
    this.state.metrics.apiCallsLast60s = this.state._apiCallTimestamps.length;
    this.state.metrics.apiRpm = this.state.metrics.apiCallsLast60s;
  }

  private recordDrop() {
    this.state.metrics.droppedEvents += 1;
  }

  private recordAck(incident: Incident, ackedAt: number) {
    const key = `${incident.dedupKey}:ack`;
    if (this.metricIncidentState.get(key)) return;
    this.metricIncidentState.set(key, { acked: true, resolved: false });
    const mtta = Math.max(0, ackedAt - incident.startedAt);
    this.state._mttaSums[incident.severity] += mtta;
    this.state._mttaCounts[incident.severity] += 1;
    this.state._mttaSums.global += mtta;
    this.state._mttaCounts.global += 1;
    this.state.metrics.avgMtta[incident.severity] =
      this.state._mttaSums[incident.severity] / this.state._mttaCounts[incident.severity];
    this.state.metrics.avgMtta.global = this.state._mttaSums.global / this.state._mttaCounts.global;
  }

  private recordResolve(incident: Incident, resolvedAt: number) {
    const key = `${incident.dedupKey}:resolve`;
    if (this.metricIncidentState.get(key)) return;
    this.metricIncidentState.set(key, { acked: true, resolved: true });
    const mttr = Math.max(0, resolvedAt - incident.startedAt);
    this.state._mttrSums[incident.severity] += mttr;
    this.state._mttrCounts[incident.severity] += 1;
    this.state._mttrSums.global += mttr;
    this.state._mttrCounts.global += 1;
    this.state.metrics.avgMttr[incident.severity] =
      this.state._mttrSums[incident.severity] / this.state._mttrCounts[incident.severity];
    this.state.metrics.avgMttr.global = this.state._mttrSums.global / this.state._mttrCounts.global;
  }

  private async pollTrackRuns() {
    if (!this.credentials.apiToken || !this.credentials.fromEmail) {
      return;
    }
    const now = Date.now();
    for (const run of this.trackRuns.values()) {
      const incidents = Object.values(run.incidentsByDedupKey || {});
      const unresolved = incidents.some((i) => i.status !== 'resolved');
      const shouldPoll = run.isActive || unresolved;
      if (!shouldPoll) continue;

      const interval = run.isActive ? 4000 : 12000;
      if (run.lastPollAt && now - run.lastPollAt < interval) continue;
      run.lastPollAt = now;

      try {
        // Discover incidents by dedup key
        const needIds = incidents.filter((i) => !i.incidentId && i.dedupKey).slice(0, 8);
        for (const inc of needIds) {
          try {
            const res = await this.pdClient.getIncidentByDedupKey(inc.dedupKey);
            const found = res?.incidents?.[0];
            if (found) {
              this.updateRunIncident(run, found, inc.dedupKey);
            }
          } catch (e: any) {
            run.errors = run.errors || [];
            run.errors.push(`Lookup failed for ${inc.dedupKey}: ${e.message}`);
          }
        }

        // Refresh known incidents
        const knownIds = incidents.map((i) => i.incidentId).filter(Boolean) as string[];
        if (knownIds.length > 0) {
          const res = await this.pdClient.getIncidentsByIds(Array.from(new Set(knownIds)));
          if (res?.incidents) {
            res.incidents.forEach((pdInc: any) => this.updateRunIncident(run, pdInc, undefined));
          }
        }
      } catch (e: any) {
        run.errors = run.errors || [];
        run.errors.push(e.message || 'Track run poll failed');
      }

      const stillUnresolved = Object.values(run.incidentsByDedupKey || {}).some((i) => i.status !== 'resolved');
      if (run.finishedAt && !stillUnresolved) {
        run.isActive = false;
        this.emitTrackRunFinished(run);
      } else {
        this.emitTrackRunUpdate(run);
      }
    }
  }

  private updateRunIncident(run: TrackRunState, pdIncident: any, dedupKeyOverride?: string) {
    const dedupKey = dedupKeyOverride || pdIncident?.incident_key || pdIncident?.dedup_key;
    if (!dedupKey) return;
    const existing = run.incidentsByDedupKey[dedupKey] || { dedupKey };
    const status = pdIncident.status;

    const ackedAt =
      existing.ackedAt ||
      (status === 'acknowledged' ? Date.parse(pdIncident?.acknowledgements?.[0]?.at || pdIncident?.last_status_change_at || '') || Date.now() : undefined);
    const resolvedAt =
      existing.resolvedAt ||
      (status === 'resolved' ? Date.parse(pdIncident?.resolved_at || pdIncident?.last_status_change_at || '') || Date.now() : undefined);

    run.incidentsByDedupKey[dedupKey] = {
      ...existing,
      dedupKey,
      incidentId: pdIncident.id,
      incidentNumber: pdIncident.incident_number,
      htmlUrl: pdIncident.html_url,
      serviceName: pdIncident.service?.summary || existing.serviceName,
      title: pdIncident.title || existing.title,
      status,
      urgency: pdIncident.urgency,
      createdAt: pdIncident.created_at,
      lastUpdatedAt: pdIncident.last_status_change_at,
      lastFetchedAt: Date.now(),
      firstSeenAt: existing.firstSeenAt || Date.now(),
      ackedAt,
      resolvedAt,
    };
  }

  private emitState() {
    const room = this.io.sockets.adapter.rooms.get(this.userId);
        this.io.to(this.userId).emit('sim_tick', this.state);
  }
}

// --- SimulationManager ---
export class SimulationManager {
  private instances = new Map<string, SimulationSession>(); // Renamed type
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  get(userId: string) {
    return this.instances.get(userId);
  }

  findActiveBySubdomain(subdomain: string, excludeUserId?: string) {
    const normalized = subdomain.trim().toLowerCase();
    if (!normalized) return null;
    for (const [userId, instance] of this.instances.entries()) {
      if (excludeUserId && userId === excludeUserId) continue;
      const activeSubdomain = instance.config.pdSubdomain?.trim().toLowerCase();
      if (instance.state.isRunning && activeSubdomain && activeSubdomain === normalized) {
        return userId;
      }
    }
    return null;
  }

  async createOrUpdate(userId: string, config: SimulationConfig, credentials: SimulationCredentials) {
    console.log(`SimulationManager: createOrUpdate for ${userId}`);
    let instance = this.instances.get(userId);
    if (instance) {
        instance.updateConfig(config); 
        instance.updateCredentials(credentials);
    } else {
        instance = new SimulationSession(userId, config, credentials, this.io);
        this.instances.set(userId, instance);
    }
    // Note: Session-level mapping profile is applied to Background Track by default
    // We might want to explicit apply it here if updated?
    return instance;
  }
  
  delete(userId: string) {
      const instance = this.instances.get(userId);
      if (instance) instance.stop();
      this.instances.delete(userId);
  }
}
