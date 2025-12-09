import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api'; // Import the API service
import { 
  PayloadAdapter, ImportedCampaign, CampaignItem,
  payloadRegistry, payloadGenerator, loadImportedCampaignBundles 
} from '../utils/payloads';

// --- Types ---
export interface Profile {
  id: string;
  name: string;
  description: string;
  settings: any; // Will be strictly typed progressively
  updatedAt: number;
}

export interface Team {
  id: string;
  name: string;
  html_url?: string;
}

export interface ServiceIntegration {
  id: string;
  name: string;
  integrationKey: string;
  vendor?: string;
}

export interface Service {
  id: string;
  name: string;
  html_url?: string;
  teams: { id: string; name: string }[];
  changeIntegrations: ServiceIntegration[];
  include: boolean; // For local selection in UI
}

export interface EscalationPolicy {
  id: string;
  name: string;
  html_url?: string;
  num_levels?: number;
  teams: { id: string; name: string }[];
}

export type IncidentSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Incident {
  dedupKey: string;
  serviceId: string;
  serviceName: string;
  startedAt: number;
  incidentId: string | null;
  mapAttempts: number;
  lastMapAttemptAt?: number; // New: Timestamp of last ID mapping attempt
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
  isMajor?: boolean;
  prioritySet?: boolean; // New v1.8
}

export interface CampaignConfig {
  enabled: boolean;
  probability: number;
  maxRelated: number;
  windowSec: number;
  templateMode: 'all' | 'custom';
  templateIds: string[];
  importedChangeRoutingKey: string;
}

export const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  enabled: true,
  probability: 0.35,
  maxRelated: 3,
  windowSec: 300,
  templateMode: 'all',
  templateIds: [],
  importedChangeRoutingKey: "",
};


export interface SimulationState {
  isGenerating: boolean; // Controls new incident creation
  isManaging: boolean;   // Controls lifecycle (ack/resolve) of existing incidents
  activeIncidents: Incident[];
  log: { ts: string; type: 'info' | 'warn' | 'error'; msg: string }[];
  monitorTrend: { ts: number; count: number }[];
  totalEvents: number;
  
  // Metrics
  avgMtta: Record<IncidentSeverity | 'global', number>; // milliseconds
  avgMttr: Record<IncidentSeverity | 'global', number>; // milliseconds
  apiRpm: number;
  apiCallsLast60s: number; // New: API calls in the last 60 seconds
  droppedEvents: number; // New: Incidents dropped due to failed mapping (suppressed)

  // Internal Counters (not exposed to UI mostly)
  _mttaSums: Record<IncidentSeverity | 'global', number>;
  _mttaCounts: Record<IncidentSeverity | 'global', number>;
  _mttrSums: Record<IncidentSeverity | 'global', number>;
  _mttrCounts: Record<IncidentSeverity | 'global', number>;
  _apiCallCount: number;
  _lastRpmCheck: number;
  _apiCallTimestamps: number[]; // New: Timestamps of recent API calls
  
  startSimulation: () => void;
  pauseSimulation: () => void; // Stop generating, keep managing
  stopSimulation: () => void; // Stop everything
  addLog: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (dedupKey: string, updates: Partial<Incident>) => void;
  removeIncident: (dedupKey: string) => void;
  clearActiveIncidents: () => void;
  addMonitorTrendData: (count: number) => void;
  incrementApiCount: () => void;
  evalTick: () => void; // Periodic evaluation for incidents
  triggerIncident: (service: Service, failureContext?: any) => Promise<void>;
  ackIncident: (dedupKey: string) => Promise<void>;
  resolveIncident: (dedupKey: string) => Promise<void>;
  resolveAllIncidents: () => Promise<void>;
}

export interface AutoHealConfig {
  enabled: boolean;
  warningProbability: number;
  minDelaySec: number;
  maxDelaySec: number;
}

export const DEFAULT_AUTO_HEAL_CONFIG: AutoHealConfig = {
  enabled: true,
  warningProbability: 0.2,
  minDelaySec: 30,
  maxDelaySec: 90,
};

export interface SeverityConfig {
  minAckSec: number;
  maxAckSec: number;
  minResolveSec: number;
  maxResolveSec: number;
  noteProbability: number;
  responderProbability: number;
}

export const DEFAULT_SEVERITY_CONFIGS: Record<IncidentSeverity, SeverityConfig> = {
  info: { // Info is suppressed, but included for completeness
    minAckSec: 0, maxAckSec: 0,
    minResolveSec: 0, maxResolveSec: 0,
    noteProbability: 0, responderProbability: 0,
  },
  warning: {
    minAckSec: 30, maxAckSec: 120,
    minResolveSec: 90, maxResolveSec: 240,
    noteProbability: 0.2, responderProbability: 0.1,
  },
  error: {
    minAckSec: 15, maxAckSec: 90,
    minResolveSec: 60, maxResolveSec: 180,
    noteProbability: 0.3, responderProbability: 0.2,
  },
  critical: {
    minAckSec: 5, maxAckSec: 60,
    minResolveSec: 30, maxResolveSec: 120,
    noteProbability: 0.4, responderProbability: 0.3,
  },
};


export interface ConfigurationState {
  apiToken: string;
  pdSubdomain: string;
  fromEmail: string;
  globalRoutingKey: string;
  selectedTeamIds: string[];
  selectedEPIds: string[];
  
  // Global Simulation Settings
  ratePerMinute: number;
  severityWeights: { info: number; warning: number; error: number; critical: number };
  autoHealConfig: AutoHealConfig;
  resumeExistingEnabled: boolean;
  sourceMix: Record<string, number>;
  burstProbability: number; // New: Probability (0-1) that an incident will have bursts
  majorIncidentProbability: number; // New v1.8
  responderAckRate: number; // New v1.8
  teamFailureProbability: number; // New v1.8.1

  // Per-Severity Simulation Settings
  severityConfigs: Record<IncidentSeverity, SeverityConfig>;

  teams: Team[];
  services: Service[];
  escalationPolicies: EscalationPolicy[];
  isLoadingTeams: boolean;
  isLoadingServices: boolean;
  isLoadingEscalationPolicies: boolean;

  campaignConfig: CampaignConfig;
  payloadAdapters: PayloadAdapter[];
  importedCampaigns: ImportedCampaign[];
  lastChangeEvent: { ts: number; serviceName: string; failureSummary: string } | null;

  setCredentials: (creds: Partial<ConfigurationState>) => void;
  setSettings: (settings: Partial<ConfigurationState>) => void;
  setSeverityConfig: (severity: IncidentSeverity, config: Partial<SeverityConfig>) => void; // New action
  setSelectedTeamIds: (ids: string[]) => void;
  setSelectedEPIds: (ids: string[]) => void;
  setServiceInclude: (serviceId: string, include: boolean) => void;
  fetchTeams: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchEscalationPolicies: () => Promise<void>;

  setCampaignConfig: (config: Partial<CampaignConfig>) => void;
  loadPayloadAdapters: () => void;
  loadImportedCampaigns: () => Promise<void>;
  triggerImportedCampaign: (campaign: ImportedCampaign) => Promise<void>;
  setLastChangeEvent: (event: { ts: number; serviceName: string; failureSummary: string } | null) => void;
}

// --- Store Definition ---

interface AppState extends SimulationState, ConfigurationState {
  profiles: Profile[];
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
  saveProfile: (profile: Profile) => void;
  createCampaign: (campaignData: Omit<ImportedCampaign, 'id' | 'source'>) => Promise<ImportedCampaign>;
  updateCampaign: (id: string, campaignData: Partial<Omit<ImportedCampaign, 'id' | 'source'>>) => Promise<ImportedCampaign>;
  deleteCampaign: (id: string) => Promise<void>;
}

const TREND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Configuration Slice Defaults ---
      apiToken: '',
      pdSubdomain: '',
      fromEmail: '',
      globalRoutingKey: '',
      selectedTeamIds: [],
      selectedEPIds: [],
      
      // Global Simulation Defaults
      ratePerMinute: 6,
      severityWeights: { info: 0.2, warning: 0.4, error: 0.25, critical: 0.15 },
      autoHealConfig: DEFAULT_AUTO_HEAL_CONFIG,
      resumeExistingEnabled: true,
      sourceMix: { cloudwatch: 0.25, datadog: 0.25, newrelic: 0.25, splunk: 0.25 },
      burstProbability: 0.5,
      majorIncidentProbability: 0.2, // Default 20% of team failures are Major
      responderAckRate: 0.9,
      teamFailureProbability: 0.01,

      // Per-Severity Simulation Defaults
      severityConfigs: DEFAULT_SEVERITY_CONFIGS,

      teams: [],
      services: [],
      escalationPolicies: [],
      isLoadingTeams: false,
      isLoadingServices: false,
      isLoadingEscalationPolicies: false,

      campaignConfig: DEFAULT_CAMPAIGN_CONFIG,
      payloadAdapters: [],
      importedCampaigns: [],
      lastChangeEvent: null,
      
      // --- Simulation Slice Defaults ---
      isGenerating: false,
      isManaging: false,
      activeIncidents: [],
      log: [],
      monitorTrend: [],
      totalEvents: 0,
      
      avgMtta: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      avgMttr: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      apiRpm: 0,
      apiCallsLast60s: 0,
      droppedEvents: 0,

      _mttaSums: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _mttaCounts: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _mttrSums: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _mttrCounts: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      _apiCallCount: 0,
      _lastRpmCheck: 0,
      _apiCallTimestamps: [],
      
      // --- Profile Slice Defaults ---
      profiles: [],
      activeProfileId: null,
      isLoadingProfiles: false,

      // --- Actions ---
      setCredentials: (creds) => set((state) => ({ ...state, ...creds })),
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
      setSeverityConfig: (severity, config) => set((state) => ({
        severityConfigs: {
          ...state.severityConfigs,
          [severity]: { ...state.severityConfigs[severity], ...config }
        }
      })),
      setSelectedTeamIds: (ids) => set({ selectedTeamIds: ids }),
      setSelectedEPIds: (ids) => set({ selectedEPIds: ids }),
      setServiceInclude: (serviceId, include) => set((state) => ({
        services: state.services.map(svc => 
          svc.id === serviceId ? { ...svc, include } : svc
        )
      })),

      fetchTeams: async () => {
        set({ isLoadingTeams: true });
        try {
          const { apiToken, fromEmail } = get();
          const allTeams: Team[] = [];
          let offset = 0;
          let more = true;

          while (more) {
            const data = await api.getTeams({ token: apiToken, fromEmail }, 100, offset);
            // v2.0: Removed hard filtering. All teams are loaded. Visibility is handled in UI components.
            allTeams.push(...data.teams);
            
            more = data.more;
            offset += data.limit || 100;
          }

          set({ teams: allTeams, isLoadingTeams: false });
          get().addLog(`Loaded ${allTeams.length} teams.`);
        } catch (error: any) {
          get().addLog(`Failed to load teams: ${error.message}`, 'error');
          set({ isLoadingTeams: false });
        }
      },

      fetchServices: async () => {
        set({ isLoadingServices: true });
        try {
          // v2.0: Fetch services for ALL loaded teams to enable Campaign Builder usage
          // regardless of Noise Simulation selection.
          const { teams, services: currentServices, apiToken, fromEmail } = get();
          const targetTeamIds = teams.map(t => t.id);

          if (!apiToken) {
            get().addLog('API Token is missing, cannot fetch services.', 'warn');
            set({ isLoadingServices: false });
            return;
          }

          const allServices: Service[] = [];
          let offset = 0;
          let more = true;
          const CHANGE_INTEGRATION_TYPES = ["events_api_v2_inbound_integration", "change_event_transform_inbound_integration"];

          while (more) {
            const data = await api.getServices(targetTeamIds, { token: apiToken, fromEmail }, 100, offset);
            
            const batch = data.services.map((svc: any) => {
              const changeIntegrations = (svc.integrations || [])
                .filter((integration: any) => CHANGE_INTEGRATION_TYPES.includes(integration?.type) && integration.integration_key)
                .map((integration: any) => ({
                  id: integration.id,
                  name: integration.summary || integration.name || integration.type,
                  integrationKey: integration.integration_key,
                  vendor: integration.vendor?.summary || integration.vendor?.name || null,
                }));

              return {
                id: svc.id,
                name: svc.name,
                html_url: svc.html_url,
                teams: (svc.teams || []).map((t: any) => ({ id: t.id, name: t.name })),
                changeIntegrations,
                include: currentServices.find(s => s.id === svc.id)?.include || false,
              };
            });

            allServices.push(...batch);
            more = data.more;
            offset += data.limit || 100;
          }

          set({ services: allServices, isLoadingServices: false });
          get().addLog(`Loaded ${allServices.length} services.`);
        } catch (error: any) {
          get().addLog(`Failed to load services: ${error.message}`, 'error');
          set({ isLoadingServices: false });
        }
      },

      fetchEscalationPolicies: async () => {
        set({ isLoadingEscalationPolicies: true });
        try {
          const { selectedTeamIds, apiToken, fromEmail } = get();
          if (!apiToken) {
            get().addLog('API Token is missing, cannot fetch escalation policies.', 'warn');
            set({ isLoadingEscalationPolicies: false });
            return;
          }

          const allPolicies: EscalationPolicy[] = [];
          let offset = 0;
          let more = true;

          while (more) {
            const data = await api.getEscalationPolicies(selectedTeamIds, { token: apiToken, fromEmail }, 100, offset);
            allPolicies.push(...data.escalation_policies);
            more = data.more;
            offset += data.limit || 100;
          }

          set({ escalationPolicies: allPolicies, isLoadingEscalationPolicies: false });
          get().addLog(`Loaded ${allPolicies.length} escalation policies.`);
        } catch (error: any) {
          get().addLog(`Failed to load escalation policies: ${error.message}`, 'error');
          set({ isLoadingEscalationPolicies: false });
        }
      },

      setCampaignConfig: (config) => set((state) => ({ 
        campaignConfig: { ...state.campaignConfig, ...config } 
      })),

      loadPayloadAdapters: () => {
        set({ payloadAdapters: payloadRegistry.list() });
        get().addLog(`Loaded ${payloadRegistry.list().length} payload adapters.`, 'info');
      },

      loadImportedCampaigns: async () => {
        try {
          // Fetch from API instead of local file parsing
          const data = await api.getCampaigns();
          const campaigns = (data.campaigns || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            source: c.source,
            items: c.items.map((i: any) => ({
              id: i.id,
              stepName: i.stepName,
              payloadString: JSON.stringify(i.payload), // Convert back to string for compatibility
              eventAction: i.eventAction,
              eventType: i.eventType,
              dedupKey: i.dedupKey,
              integrationKey: i.integrationKey,
              delaySeconds: i.delaySeconds,
              times: i.repeatCount, // Map DB 'repeatCount' to frontend 'times'
              intervalSeconds: i.intervalSeconds,
            }))
          }));
          
          set({ importedCampaigns: campaigns });
          get().addLog(`Loaded ${campaigns.length} campaigns from database.`, 'info');
        } catch (error: any) {
          get().addLog(`Failed to load campaigns: ${error.message}`, 'error');
        }
      },

      triggerImportedCampaign: async (campaign: ImportedCampaign) => {
        const { addLog, apiToken, globalRoutingKey, campaignConfig, setLastChangeEvent } = get();
        addLog(`Triggering imported campaign "${campaign.name}" (${campaign.items.length} steps).`, 'info');

        if (!apiToken) {
          addLog('API Token is missing. Cannot trigger campaign.', 'error');
          return;
        }
        if (!globalRoutingKey && campaign.items.some(item => item.eventType === 'incident')) {
          addLog('Global Routing Key is missing. Cannot trigger incident events in campaign.', 'error');
          return;
        }
        if (!campaignConfig.importedChangeRoutingKey && campaign.items.some(item => item.eventType === 'change')) {
          addLog('Imported Change Routing Key is missing. Cannot trigger change events in campaign.', 'error');
          return;
        }

        for (const item of campaign.items) {
          await new Promise(resolve => setTimeout(resolve, item.delaySeconds * 1000)); // Delay between campaign items

          const fireEvent = async () => {
            try {
              const payload = JSON.parse(item.payloadString);
              let response;

              if (item.eventType === 'incident') {
                const eventBody = {
                  routing_key: globalRoutingKey,
                  event_action: item.eventAction || 'trigger',
                  dedup_key: item.dedupKey || crypto.randomUUID(),
                  payload: {
                    ...payload,
                    source: payload.source || 'pd-noise-simulator-campaign',
                  }
                };
                response = await api.triggerEvent(eventBody);
                addLog(`  -> Fired incident event for "${item.id}" (dedup: ${eventBody.dedup_key.substring(0,8)}).`, 'info');
              } else if (item.eventType === 'change') {
                const changeEventBody = {
                  routing_key: campaignConfig.importedChangeRoutingKey,
                  payload: {
                    ...payload,
                    source: payload.source || 'pd-noise-simulator-campaign',
                  }
                };
                response = await api.triggerChangeEvent(changeEventBody);
                addLog(`  -> Fired change event for "${item.id}".`, 'info');
                // Store last change event for potential display on monitor
                setLastChangeEvent({ 
                  ts: Date.now(), 
                  serviceName: payload.custom_details?.service_name || "Unknown", 
                  failureSummary: payload.summary || payload.custom_details?.summary || "Campaign Change" 
                });
              }
              set((state) => ({ totalEvents: state.totalEvents + 1 }));
            } catch (error: any) {
              addLog(`  -> Failed to fire event for "${item.id}": ${error.message}`, 'error');
            }
          };

          // Fire the event/change event 'times' number of times with 'intervalSeconds' delay
          for (let i = 0; i < (item.times || 1); i++) {
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, item.intervalSeconds * 1000));
            }
            await fireEvent();
          }
        }
        addLog(`Campaign "${campaign.name}" dispatched.`, 'info');
      },
      setLastChangeEvent: (event) => set({ lastChangeEvent: event }),
      
      startSimulation: () => set({ isGenerating: true, isManaging: true }),
      pauseSimulation: () => set({ isGenerating: false, isManaging: true }),
      stopSimulation: () => set({ isGenerating: false, isManaging: false }),
      
      addLog: (msg, type = 'info') => set((state) => ({
        log: [{ ts: new Date().toLocaleTimeString(), type, msg }, ...state.log].slice(0, 800)
      })),

      addIncident: (incident) => set((state) => ({
        activeIncidents: [incident, ...state.activeIncidents],
      })),

      updateIncident: (dedupKey, updates) => set((state) => ({
        activeIncidents: state.activeIncidents.map(inc => 
          inc.dedupKey === dedupKey ? { ...inc, ...updates } : inc
        ),
      })),

      removeIncident: (dedupKey) => set((state) => ({
        activeIncidents: state.activeIncidents.filter(inc => inc.dedupKey !== dedupKey),
      })),
      
      clearActiveIncidents: () => set({ activeIncidents: [] }),

      addMonitorTrendData: (count) => set((state) => {
        const nowTs = Date.now();
        const windowStart = nowTs - TREND_WINDOW_MS;
        const trimmed = state.monitorTrend.filter((point) => point.ts >= windowStart);
        return { monitorTrend: [...trimmed, { ts: nowTs, count }] };
      }),

      incrementApiCount: () => set((state) => ({ 
        _apiCallCount: state._apiCallCount + 1,
        _apiCallTimestamps: [...state._apiCallTimestamps, Date.now()]
      })),

      evalTick: async () => {
        const { isManaging, activeIncidents, updateIncident, removeIncident, addLog, apiToken, fromEmail, severityConfigs, ackIncident, _lastRpmCheck, _apiCallCount, _apiCallTimestamps } = get();
        
        if (!isManaging) return;

        const now = Date.now();

        // Prune old timestamps and calculate apiCallsLast60s
        const oneMinuteAgo = now - 60000;
        const recentTimestamps = _apiCallTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
        set({ _apiCallTimestamps: recentTimestamps, apiCallsLast60s: recentTimestamps.length });

        // Update RPM every 5 seconds (Current RPM calculation based on last 5s burst)
        if (now - _lastRpmCheck > 5000) {
            // If first run, just set ts
            if (_lastRpmCheck === 0) {
                set({ _lastRpmCheck: now });
            } else {
                const elapsed = now - _lastRpmCheck;
                const rpm = Math.round(_apiCallCount * (60000 / elapsed));
                set({ apiRpm: rpm, _apiCallCount: 0, _lastRpmCheck: now });
            }
        }

        // Periodic resolution of ID mapping (Rate limited to 2 per tick)
        if (apiToken) {
            const pendingCandidates = activeIncidents.filter(inc => 
                !inc.incidentId &&
                (
                    (inc.mapAttempts === 0 && now - inc.startedAt > 10000) || // Attempt 0: Wait 10s
                    (inc.mapAttempts === 1 && inc.lastMapAttemptAt && now - inc.lastMapAttemptAt > 30000) // Attempt 1: Wait 30s
                )
            );

            for (const candidate of pendingCandidates.slice(0, 2)) {
                try {
                    const response = await api.getIncidentByDedupKey(candidate.dedupKey, { token: apiToken, fromEmail });
                    const match = response.incidents?.[0];
                    
                    if (match) {
                        updateIncident(candidate.dedupKey, { incidentId: match.id });
                    } else {
                        // Not found
                        if (candidate.mapAttempts === 0) {
                            // Retry later
                            updateIncident(candidate.dedupKey, { mapAttempts: 1, lastMapAttemptAt: now });
                        } else {
                            // Drop
                            removeIncident(candidate.dedupKey);
                            set((state) => ({ droppedEvents: state.droppedEvents + 1 }));
                            addLog(`Dropped incident ${candidate.dedupKey.substring(0, 8)} (Suppressed/Grouped)`, 'warn');
                        }
                    }
                } catch (e) { 
                    // Ignore transient API errors, try again next tick
                }
            }
        }

        // Sync checks for auto-resolve/heal and noise generation
        for (const inc of activeIncidents) {
          if (!inc.incidentId) continue;
          
          const config = severityConfigs[inc.severity];
          if (!config) continue;

          // Auto-Resolve Check
          if (inc.resolveAt && now >= inc.resolveAt) {
            const timeToResolve = now - inc.startedAt;
            set((state) => {
                const sev = inc.severity;
                const newCounts = { ...state._mttrCounts };
                const newSums = { ...state._mttrSums };
                const newAvgs = { ...state.avgMttr };

                newCounts.global++;
                newSums.global += timeToResolve;
                newAvgs.global = newSums.global / newCounts.global;

                newCounts[sev]++;
                newSums[sev] += timeToResolve;
                newAvgs[sev] = newSums[sev] / newCounts[sev];

                return { _mttrCounts: newCounts, _mttrSums: newSums, avgMttr: newAvgs };
            });

            removeIncident(inc.dedupKey);
            addLog(`Auto-resolved incident ${inc.dedupKey.substring(0, 8)}...`, 'info');
            
            try {
                if (apiToken) {
                    await api.addNote(inc.incidentId, `Auto-resolved by simulator (Duration: ${((now - inc.startedAt)/1000).toFixed(0)}s)`, { token: apiToken, fromEmail });
                    await api.manageIncident(inc.incidentId, fromEmail, 'resolve', apiToken);
                }
            } catch (e) { /* ignore */ }
            continue;
          }
          
          // Auto-Heal Check (Warning only)
          if (inc.autoHealScheduled && inc.autoHealAt && now >= inc.autoHealAt) {
             const timeToResolve = now - inc.startedAt;
             set((state) => {
                const sev = inc.severity;
                const newCounts = { ...state._mttrCounts };
                const newSums = { ...state._mttrSums };
                const newAvgs = { ...state.avgMttr };

                newCounts.global++;
                newSums.global += timeToResolve;
                newAvgs.global = newSums.global / newCounts.global;

                newCounts[sev]++;
                newSums[sev] += timeToResolve;
                newAvgs[sev] = newSums[sev] / newCounts[sev];

                return { _mttrCounts: newCounts, _mttrSums: newSums, avgMttr: newAvgs };
            });

             removeIncident(inc.dedupKey);
             addLog(`Auto-healed warning incident ${inc.dedupKey.substring(0, 8)}...`, 'info');
             try {
                if (apiToken) {
                    await api.addNote(inc.incidentId, "Auto-healed by simulator (Warning suppression)", { token: apiToken, fromEmail });
                    await api.manageIncident(inc.incidentId, fromEmail, 'resolve', apiToken);
                }
             } catch (e) { /* ignore */ }
             continue;
          }

          // --- Stochastic Noise ---
          
          // Auto-Ack
          if (!inc.acked && inc.autoAckAt && now >= inc.autoAckAt) {
            ackIncident(inc.dedupKey);
          }

          // Add Notes
          if (inc.acked && (!inc.lastNoteAt || (now - inc.lastNoteAt > 30000)) && Math.random() < config.noteProbability) {
             const note = inc.noteContext[Math.floor(Math.random() * inc.noteContext.length)] || "Investigating...";
             try {
                 await api.addNote(inc.incidentId, note, { token: apiToken, fromEmail });
                 updateIncident(inc.dedupKey, { lastNoteAt: now });
                 addLog(`Added note to ${inc.incidentId}: "${note}"`, 'info');
             } catch (e) { /* ignore */ }
          }
          
          // Request Responder
          if (inc.acked && !inc.responderRequested && Math.random() < config.responderProbability) {
            updateIncident(inc.dedupKey, { responderRequested: true });
            addLog(`Simulating responder request for ${inc.incidentId}`, 'info');
          }
        }
      },

      triggerIncident: async (service: Service, failureContext: any = null) => {
        const { sourceMix, globalRoutingKey, severityWeights, autoHealConfig, severityConfigs, burstProbability } = get();
        
        if (!globalRoutingKey) {
          get().addLog('Global Routing Key missing. Cannot trigger incident.', 'warn');
          return;
        }

        // Generate Payload
        const { payload } = payloadGenerator.buildEvent({
          service,
          failure: failureContext,
          sourceMix,
        });

        // Force service name match for routing
        if (payload.custom_details) {
          payload.custom_details.service_name = service.name;
        } else {
          payload.custom_details = { service_name: service.name };
        }

        // Determine Severity
        const isMajor = failureContext?.isMajor || false;
        const severity = (() => {
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
              generator: 'pd-noise-simulator',
              sim_is_major: isMajor
            }
          }
        };

        try {
          // --- Send initial event ---
          const response = await api.triggerEvent(baseEventBody);
          let incidentDedupKey = response.dedup_key || dedupKey || 'unknown';
          
          if (severity !== 'info') {
             // Calculate timings based on severity config
             const now = Date.now();
             const config = severityConfigs[severity];
             
             // Major incidents take longer to resolve (2x - 5x)
             const resolveMult = isMajor ? (Math.random() * 3 + 2) : 1;

             const ackDelay = (Math.min(config.minAckSec, config.maxAckSec) + Math.random() * Math.abs(config.maxAckSec - config.minAckSec)) * 1000;
             const resolveDelay = (Math.min(config.minResolveSec, config.maxResolveSec) + Math.random() * Math.abs(config.maxResolveSec - config.minResolveSec)) * 1000 * resolveMult;
             
             const shouldAutoHeal = !isMajor && severity === 'warning' && autoHealConfig.enabled && Math.random() < autoHealConfig.warningProbability;
             const autoHealDelay = shouldAutoHeal 
                ? (Math.min(autoHealConfig.minDelaySec, autoHealConfig.maxDelaySec) + Math.random() * Math.abs(autoHealConfig.maxDelaySec - autoHealConfig.minDelaySec)) * 1000 
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
               observabilitySource: payload.source || 'unknown',
               failureId: failureContext?.id || null,
               failureSummary: failureContext?.summary || null,
               noteContext: payload.noteTemplates || [],
               syncedFromPd: false,
               isMajor: isMajor
             };
             
             get().addIncident(newIncident);
             set((state) => ({ totalEvents: state.totalEvents + 1 }));
             get().addLog(isMajor ? `MAJOR INCIDENT TRIGGERED for ${service.name}!` : `Triggered ${severity} incident for ${service.name}`, isMajor ? 'error' : 'info');
          }

          // --- Event Burst Logic (Async & Random) ---
          if (severity !== 'info' && (isMajor || Math.random() < burstProbability)) {
             // Randomize burst count (2 to 7) - higher for major
             const burstCount = isMajor ? Math.floor(Math.random() * (10 - 5 + 1)) + 5 : Math.floor(Math.random() * (7 - 2 + 1)) + 2;
             
             // Non-blocking loop
             (async () => {
                 for (let i = 1; i < burstCount; i++) {
                     // Randomize interval (10s to 40s)
                     const intervalMs = (Math.floor(Math.random() * (40 - 10 + 1)) + 10) * 1000;
                     await new Promise(r => setTimeout(r, intervalMs));
                     
                     // Check liveness: if resolved/removed, stop bursting
                     const currentIncidents = get().activeIncidents;
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
                      
                      // Fire burst event
                      await api.triggerEvent(burstEventBody).catch(e => console.error("Burst event failed", e));
                      set((state) => ({ totalEvents: state.totalEvents + 1 }));
                      get().addLog(`Sent burst event ${i + 1}/${burstCount} for ${incidentDedupKey.substring(0, 8)}`, 'info');
                 }
             })();
          }

        } catch (error: any) {
          get().addLog(`Failed to trigger incident: ${error.message}`, 'error');
        }
      },

      ackIncident: async (dedupKey: string) => {
        const { activeIncidents, apiToken, fromEmail, updateIncident, addLog } = get();
        const incident = activeIncidents.find(i => i.dedupKey === dedupKey);
        if (!incident || !incident.incidentId || !apiToken) return;

        try {
          await api.manageIncident(incident.incidentId, fromEmail, 'acknowledge', apiToken);
          
          // Update MTTA
          const now = Date.now();
          const timeToAck = now - incident.startedAt;
          set((state) => {
            const sev = incident.severity;
            const newCounts = { ...state._mttaCounts };
            const newSums = { ...state._mttaSums };
            const newAvgs = { ...state.avgMtta };

            // Update Global
            newCounts.global++;
            newSums.global += timeToAck;
            newAvgs.global = newSums.global / newCounts.global;

            // Update Severity
            newCounts[sev]++;
            newSums[sev] += timeToAck;
            newAvgs[sev] = newSums[sev] / newCounts[sev];

            return {
              _mttaCounts: newCounts,
              _mttaSums: newSums,
              avgMtta: newAvgs
            };
          });

          updateIncident(dedupKey, { acked: true, ackAt: now });
          addLog(`Acknowledged incident ${incident.incidentId}`, 'info');
        } catch (e: any) {
          addLog(`Failed to ack incident: ${e.message}`, 'error');
        }
      },

      resolveIncident: async (dedupKey: string) => {
        const { activeIncidents, apiToken, fromEmail, removeIncident, addLog } = get();
        const incident = activeIncidents.find(i => i.dedupKey === dedupKey);
        if (!incident || !incident.incidentId || !apiToken) return;

        try {
          await api.manageIncident(incident.incidentId, fromEmail, 'resolve', apiToken);
          
          // Update MTTR
          const now = Date.now();
          const timeToResolve = now - incident.startedAt;
          set((state) => {
            const sev = incident.severity;
            const newCounts = { ...state._mttrCounts };
            const newSums = { ...state._mttrSums };
            const newAvgs = { ...state.avgMttr };

            // Update Global
            newCounts.global++;
            newSums.global += timeToResolve;
            newAvgs.global = newSums.global / newCounts.global;

            // Update Severity
            newCounts[sev]++;
            newSums[sev] += timeToResolve;
            newAvgs[sev] = newSums[sev] / newCounts[sev];

            return {
              _mttrCounts: newCounts,
              _mttrSums: newSums,
              avgMttr: newAvgs
            };
          });

          removeIncident(dedupKey);
          addLog(`Resolved incident ${incident.incidentId}`, 'info');
        } catch (e: any) {
          addLog(`Failed to resolve incident: ${e.message}`, 'error');
        }
      },

      resolveAllIncidents: async () => {
        const { activeIncidents, resolveIncident, addLog } = get();
        addLog(`Resolving all ${activeIncidents.length} active incidents...`, 'info');
        // Resolve in parallel
        await Promise.all(activeIncidents.map(inc => resolveIncident(inc.dedupKey)));
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),
      
      saveProfile: async (profileData) => {
        const { profiles } = get();
        const existing = profileData.id ? profiles.find(p => p.id === profileData.id) : null;
        
        try {
          let savedProfile;
          // Pass only the data the API expects (name, description, settings)
          const apiPayload = {
            name: profileData.name,
            description: profileData.description,
            settings: profileData.settings,
          };

          if (existing) {
            savedProfile = await api.updateProfile(existing.id, apiPayload);
            get().addLog(`Profile "${savedProfile.name}" updated.`, 'info');
          } else {
            savedProfile = await api.createProfile(apiPayload);
            get().addLog(`Profile "${savedProfile.name}" created.`, 'info');
          }
          
          // Refresh list
          await get().fetchProfiles();
          set({ activeProfileId: savedProfile.id });
        } catch (error: any) {
          get().addLog(`Failed to save profile: ${error.message}`, 'error');
        }
      },

      deleteProfile: async (id) => {
        try {
          await api.deleteProfile(id);
          get().addLog('Profile deleted.', 'info');
          await get().fetchProfiles();
          if (get().activeProfileId === id) {
            set({ activeProfileId: null });
          }
        } catch (error: any) {
          get().addLog(`Failed to delete profile: ${error.message}`, 'error');
        }
      },

      createCampaign: async (campaignData: Omit<ImportedCampaign, 'id' | 'source'>) => {
        try {
          // Transform payloadString back to payload JSON object for the backend
          // And map 'times' to 'repeatCount'
          const apiPayload = {
            ...campaignData,
            items: campaignData.items.map(item => {
              let payload = {};
              try {
                payload = JSON.parse(item.payloadString || '{}');
              } catch (e) {
                console.error("Failed to parse payloadString for item", item.id);
              }
              return { 
                  ...item, 
                  payload,
                  repeatCount: item.times || 1 // Map frontend 'times' to backend 'repeatCount'
              };
            })
          };

          const newCampaign = await api.createCampaign(apiPayload);
          get().addLog(`Campaign "${newCampaign.name}" created.`, 'info');
          await get().loadImportedCampaigns(); // Reload all campaigns
          return newCampaign;
        } catch (error: any) {
          get().addLog(`Failed to create campaign: ${error.message}`, 'error');
          throw error;
        }
      },

      updateCampaign: async (id: string, campaignData: Partial<Omit<ImportedCampaign, 'id' | 'source'>>) => {
        try {
          // Transform payloadString back to payload JSON object for the backend
          // And map 'times' to 'repeatCount'
          const apiPayload = {
            ...campaignData,
            items: campaignData.items?.map(item => {
              let payload = {};
              try {
                payload = JSON.parse(item.payloadString || '{}');
              } catch (e) {
                console.error("Failed to parse payloadString for item", item.id);
              }
              return { 
                  ...item, 
                  payload,
                  repeatCount: item.times || 1 // Map frontend 'times' to backend 'repeatCount'
              };
            })
          };

          const updatedCampaign = await api.updateCampaign(id, apiPayload);
          get().addLog(`Campaign "${updatedCampaign.name}" updated.`, 'info');
          await get().loadImportedCampaigns(); // Reload all campaigns
          return updatedCampaign;
        } catch (error: any) {
          get().addLog(`Failed to update campaign: ${error.message}`, 'error');
          throw error;
        }
      },

      deleteCampaign: async (id: string) => {
        try {
          await api.deleteCampaign(id);
          get().addLog('Campaign deleted.', 'info');
          await get().loadImportedCampaigns(); // Reload all campaigns
        } catch (error: any) {
          get().addLog(`Failed to delete campaign: ${error.message}`, 'error');
          throw error;
        }
      },
    }),
    {
      name: 'pdns-storage', // Unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist only configuration and profiles, not runtime state like logs or activeIncidents
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        apiToken: state.apiToken,
        pdSubdomain: state.pdSubdomain,
        fromEmail: state.fromEmail,
        globalRoutingKey: state.globalRoutingKey,
        selectedTeamIds: state.selectedTeamIds,
        campaignConfig: state.campaignConfig,
        
        // Persist Simulation Settings
        ratePerMinute: state.ratePerMinute,
        severityWeights: state.severityWeights,
        autoHealConfig: state.autoHealConfig,
        resumeExistingEnabled: state.resumeExistingEnabled,
        sourceMix: state.sourceMix,
        burstProbability: state.burstProbability,
        majorIncidentProbability: state.majorIncidentProbability,
        responderAckRate: state.responderAckRate,
        teamFailureProbability: state.teamFailureProbability,

        // Persist Per-Severity Simulation Settings
        severityConfigs: state.severityConfigs,
      }),
    }
  )
);
