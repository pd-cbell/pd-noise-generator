import { SimulationConfig, SimulationCredentials, SimulationState, Incident, TrackInfo } from '../../types';
import { PagerDutyClient } from '../PagerDutyClient';
import { MappingProfileWithMappings, SimulatorConfig as MappingSimulatorConfig } from '../MappingResolver';
import { Server } from 'socket.io'; 
import { serverConfig } from '../../config';

// Abstract base class for all simulation tracks
export abstract class SimulationTrack {
  public readonly id: string;
  public abstract type: 'background' | 'scenario';
  public status: 'running' | 'completed' | 'stopped' = 'stopped';
  
  protected config: SimulationConfig;
  protected credentials: SimulationCredentials;
  protected io: Server;
  protected pdClient: PagerDutyClient;
  protected mappingProfile: MappingProfileWithMappings | null = null;
  protected simulatorConfig: MappingSimulatorConfig = { pdChangeEventsRoutingKey: null };
  protected onApiCall?: () => void;
  protected onIncidentAcked?: (incident: Incident, ackedAt: number) => void;
  protected onIncidentResolved?: (incident: Incident, resolvedAt: number) => void;
  protected onDroppedEvent?: () => void;

  public activeIncidents: Incident[] = []; 
  public log: { ts: string; type: 'info' | 'warn' | 'error'; msg: string }[] = [];

  constructor(
    id: string,
    config: SimulationConfig,
    credentials: SimulationCredentials,
    io: Server,
    callbacks?: {
      onApiCall?: () => void;
      onIncidentAcked?: (incident: Incident, ackedAt: number) => void;
      onIncidentResolved?: (incident: Incident, resolvedAt: number) => void;
      onDroppedEvent?: () => void;
    }
  ) {
    this.id = id;
    this.config = config;
    this.credentials = credentials;
    this.io = io;
    this.onApiCall = callbacks?.onApiCall;
    this.onIncidentAcked = callbacks?.onIncidentAcked;
    this.onIncidentResolved = callbacks?.onIncidentResolved;
    this.onDroppedEvent = callbacks?.onDroppedEvent;
    this.pdClient = new PagerDutyClient({
      apiToken: credentials.apiToken,
      fromEmail: credentials.fromEmail,
      pdRegion: credentials.pdRegion,
      apiBase: serverConfig.pdApiBase, 
      onRequest: callbacks?.onApiCall,
    });
  }

  // Abstract methods to be implemented by concrete tracks
  public abstract start(): void;
  public abstract stop(): void;
  public abstract tick(): Promise<void>;

  public getTrackInfo(): TrackInfo {
      return {
          id: this.id,
          type: this.type,
          name: this.config.goldenDemoId ? `Demo: ${this.config.goldenDemoId}` : (this.type === 'background' ? 'Background Noise' : 'Scenario'), // Simple name derivation
          status: this.status
      };
  }

  // Common utility methods (can be overridden)
  protected addLog(msg: string, type: 'info' | 'warn' | 'error' = 'info') {
    this.log.unshift({ ts: new Date().toLocaleTimeString(), type, msg });
    if (this.log.length > 800) this.log.pop();
  }

  protected addIncident(incident: Incident) {
    this.activeIncidents.unshift(incident);
  }

  protected updateIncident(dedupKey: string, updates: Partial<Incident>) {
    this.activeIncidents = this.activeIncidents.map(inc =>
      inc.dedupKey === dedupKey ? { ...inc, ...updates } : inc
    );
  }

  protected removeIncident(dedupKey: string) {
    this.activeIncidents = this.activeIncidents.filter(inc => inc.dedupKey !== dedupKey);
  }

  public drainLogs() {
    if (this.log.length === 0) return [];
    const drained = this.log;
    this.log = [];
    return drained;
  }

  public async applyMappingProfile(profile: MappingProfileWithMappings | null) {
    this.mappingProfile = profile;
    this.simulatorConfig = {
      pdChangeEventsRoutingKey: this.config.changeRoutingKey, // Use track-specific change routing key
    };
  }

  // Placeholder for getting current state - to be implemented by concrete tracks
  public getTrackState(): Partial<SimulationState> {
    return {
      activeIncidents: this.activeIncidents,
      log: this.log,
      // Metrics and other state specific to this track can go here
    };
  }
}
