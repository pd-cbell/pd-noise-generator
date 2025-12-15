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
        bgTrack = new BackgroundTrack('background', this.config, this.credentials, this.io);
        // Apply mapping profile if global config has one
        if (this.config.mappingProfileId) {
            const profile = await mappingProfileService.getMappingProfileById(this.config.mappingProfileId);
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
          track = new ScenarioTrack(id, scenarioConfig, this.credentials, this.io);
      } else {
          // Background
          track = new BackgroundTrack(id, this.config, this.credentials, this.io);
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
          const profile = await mappingProfileService.getMappingProfileById(this.config.mappingProfileId);
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
      const profile = await mappingProfileService.getMappingProfileById(mappingProfileId);
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
      });

      // Sort by start time descending
      allIncidents.sort((a, b) => b.startedAt - a.startedAt);
      this.state.activeIncidents = allIncidents;
      this.state.tracks = trackInfos;

      // Update Trend
      this.addMonitorTrendData(this.state.activeIncidents.length);

      this.emitState();
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

  async createOrUpdate(userId: string, config: SimulationConfig, credentials: SimulationCredentials) {
    console.log(`SimulationManager: createOrUpdate for ${userId}`);
    let instance = this.instances.get(userId);
    if (instance) {
        instance.updateConfig(config); 
        instance.updateCredentials(credentials);
    } else {
        instance = new SimulationSession(userId, config, credentials, this.io);
        this.instances.set(userId, instance);
        
        // Socket listener for injection
        this.io.of('/').adapter.on('join-room', (room, id) => {
          if (room === userId) {
            const clientSocket = this.io.of('/').sockets.get(id);
            if (clientSocket) {
              clientSocket.on('stop_track', ({ trackId }: { trackId: string }, callback?: (err?: any) => void) => {
                const session = this.instances.get(userId);
                if (session) {
                  session.stopTrack(trackId);
                  if (callback) callback(null);
                } else {
                  if (callback) callback({ message: "Session not found" });
                }
              });

              clientSocket.on('inject_golden_demo_items', async ({ items, mappingProfileId }: { items: any[], mappingProfileId?: string }, callback?: (err?: any) => void) => {
                try {
                  const session = this.instances.get(userId);
                  if (session) {
                    // Create new Scenario Track
                    const track = await session.startTrack('scenario', items);
                    if (mappingProfileId) {
                        await session.applyMappingToNewTrack(track, mappingProfileId);
                    }
                    if (callback) callback(null);
                  } else {
                    if (callback) callback({ message: "Session not found" });
                  }
                } catch (e: any) {
                  console.error("Error injecting scenario:", e);
                  if (callback) callback({ message: e.message });
                }
              });
            }
          }
        });
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