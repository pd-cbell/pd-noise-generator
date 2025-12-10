import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api'; // Import the API service
import { GoldenDemo, Session } from '../../../server/src/types'; // Import GoldenDemo and Session types
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
  persona?: string; // New: ChatOps tone/persona
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
  pdRegion: 'US' | 'EU'; // New: PagerDuty region
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

  goldenDemos: GoldenDemo[]; // New: List of Golden Demos
  isLoadingGoldenDemos: boolean; // New: Loading state for Golden Demos
  fetchGoldenDemos: (vertical?: string) => Promise<void>;
  createGoldenDemo: (goldenDemo: Omit<GoldenDemo, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'>) => Promise<GoldenDemo>;
  updateGoldenDemo: (id: string, goldenDemo: Partial<Omit<GoldenDemo, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'>>) => Promise<GoldenDemo>;
  deleteGoldenDemo: (id: string) => Promise<void>;

  // Session State (Phase 4.3)
  activeSessionId: string | null;
  startSession: (data: { goldenDemoId: string; name?: string; notes?: string }) => Promise<void>;
  endSession: (notes?: string) => Promise<void>;
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
      pdRegion: 'US', // Default to US
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

      // --- Golden Demo Slice Defaults ---
      goldenDemos: [],
      isLoadingGoldenDemos: false,

      // --- Session Slice Defaults ---
      activeSessionId: null,

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
            integrationKey: c.integrationKey || '',
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
        const { addLog, globalRoutingKey, campaignConfig } = get();
        addLog(`Triggering imported campaign "${campaign.name}" (${campaign.items.length} steps) via webhook.`, 'info');

        const routingKey = campaign.integrationKey || globalRoutingKey || undefined;
        const changeRoutingKey = campaign.integrationKey || campaignConfig.importedChangeRoutingKey || undefined;

        try {
          await api.triggerCampaign(campaign.id, { routingKey, changeRoutingKey });
          addLog(`Webhook accepted for "${campaign.name}".`, 'info');
        } catch (error: any) {
          addLog(`Failed to trigger campaign "${campaign.name}": ${error.message}`, 'error');
          throw error;
        }
      },
      setLastChangeEvent: (event) => set({ lastChangeEvent: event }),

      // --- Golden Demo Actions ---
      fetchGoldenDemos: async (vertical?: string) => {
        set({ isLoadingGoldenDemos: true });
        try {
          const fetchedDemos = await api.getGoldenDemos(vertical);
          set({ goldenDemos: fetchedDemos });
          get().addLog(`Loaded ${fetchedDemos.length} Golden Demos.`, 'info');
        } catch (error: any) {
          get().addLog(`Failed to load Golden Demos: ${error.message}`, 'error');
        } finally {
          set({ isLoadingGoldenDemos: false });
        }
      },

      createGoldenDemo: async (goldenDemoData) => {
        try {
          const newDemo = await api.createGoldenDemo(goldenDemoData);
          get().addLog(`Golden Demo "${newDemo.name}" created.`, 'info');
          get().fetchGoldenDemos(); // Refresh list
          return newDemo;
        } catch (error: any) {
          get().addLog(`Failed to create Golden Demo: ${error.message}`, 'error');
          throw error;
        }
      },

      updateGoldenDemo: async (id, goldenDemoData) => {
        try {
          const updatedDemo = await api.updateGoldenDemo(id, goldenDemoData);
          get().addLog(`Golden Demo "${updatedDemo.name}" updated.`, 'info');
          get().fetchGoldenDemos(); // Refresh list
          return updatedDemo;
        } catch (error: any) {
          get().addLog(`Failed to update Golden Demo: ${error.message}`, 'error');
          throw error;
        }
      },

      deleteGoldenDemo: async (id) => {
        try {
          await api.deleteGoldenDemo(id);
          get().addLog('Golden Demo deleted.', 'info');
          get().fetchGoldenDemos(); // Refresh list
        } catch (error: any) {
          get().addLog(`Failed to delete Golden Demo: ${error.message}`, 'error');
          throw error;
        }
      },

      // --- Session Actions ---
      startSession: async (data) => {
        try {
          const session = await api.startSession(data);
          set({ activeSessionId: session.id });
          get().addLog(`Session "${data.name || session.id}" started.`, 'info');
        } catch (error: any) {
          get().addLog(`Failed to start session: ${error.message}`, 'error');
          throw error;
        }
      },

      endSession: async (notes) => {
        const { activeSessionId } = get();
        if (!activeSessionId) return;
        try {
          await api.endSession(activeSessionId, notes);
          set({ activeSessionId: null });
          get().addLog('Session ended.', 'info');
        } catch (error: any) {
          get().addLog(`Failed to end session: ${error.message}`, 'error');
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
        pdRegion: state.pdRegion, // Persist pdRegion
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
        
        // DO NOT persist goldenDemos or isLoadingGoldenDemos, they are fetched from backend
        // goldenDemos: state.goldenDemos, 
        // isLoadingGoldenDemos: state.isLoadingGoldenDemos,
        
        // DO NOT persist session state
        // activeSessionId: state.activeSessionId,
      }),
    }
  )
);