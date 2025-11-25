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
  nextEvalAt: number;
  ackAt: number | null;
  acked: boolean;
  firstResponderAt: number | null;
  responderRequested: boolean;
  severity: IncidentSeverity;
  resolveAt: number | null;
  autoHealAt: number | null;
  autoHealScheduled: boolean;
  observabilitySource: string;
  failureId: string | null;
  failureSummary: string | null;
  noteContext: string[];
  syncedFromPd: boolean;
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

const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  enabled: true,
  probability: 0.35,
  maxRelated: 3,
  windowSec: 300,
  templateMode: 'all',
  templateIds: [],
  importedChangeRoutingKey: "",
};


export interface SimulationState {
  isRunning: boolean;
  activeIncidents: Incident[];
  log: { ts: string; type: 'info' | 'warn' | 'error'; msg: string }[];
  monitorTrend: { ts: number; count: number }[];
  startSimulation: () => void;
  stopSimulation: () => void;
  addLog: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (dedupKey: string, updates: Partial<Incident>) => void;
  removeIncident: (dedupKey: string) => void;
  clearActiveIncidents: () => void;
  addMonitorTrendData: (count: number) => void;
  evalTick: () => void; // Periodic evaluation for incidents
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

export interface ConfigurationState {
  apiToken: string;
  pdSubdomain: string;
  fromEmail: string;
  globalRoutingKey: string;
  selectedTeamIds: string[];
  selectedEPIds: string[]; // Added for Escalation Policy selection
  
  // Simulation Settings
  ratePerMinute: number;
  noteProbability: number;
  responderProbabilityMultiplier: number;
  autoResolveMinSec: number;
  autoResolveMaxSec: number;
  severityWeights: { info: number; warning: number; error: number; critical: number };
  autoHealConfig: AutoHealConfig;
  resumeExistingEnabled: boolean;
  sourceMix: Record<string, number>;

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
  setSelectedTeamIds: (ids: string[]) => void;
  setSelectedEPIds: (ids: string[]) => void; // Added for Escalation Policy selection
  setServiceInclude: (serviceId: string, include: boolean) => void;
  fetchTeams: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchEscalationPolicies: () => Promise<void>;

  setCampaignConfig: (config: Partial<CampaignConfig>) => void;
  loadPayloadAdapters: () => void;
  loadImportedCampaigns: () => Promise<void>;
  triggerImportedCampaign: (campaign: ImportedCampaign) => Promise<void>; // Will be async
  setLastChangeEvent: (event: { ts: number; serviceName: string; failureSummary: string } | null) => void;
}

// --- Store Definition ---

interface AppState extends SimulationState, ConfigurationState {
  profiles: Profile[];
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
  saveProfile: (profile: Profile) => void;
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
      selectedEPIds: [], // Initialized
      
      // Simulation Defaults
      ratePerMinute: 6,
      noteProbability: 0.5,
      responderProbabilityMultiplier: 1.0,
      autoResolveMinSec: 90,
      autoResolveMaxSec: 240,
      severityWeights: { info: 0.2, warning: 0.4, error: 0.25, critical: 0.15 },
      autoHealConfig: DEFAULT_AUTO_HEAL_CONFIG,
      resumeExistingEnabled: true,
      sourceMix: { cloudwatch: 0.25, datadog: 0.25, newrelic: 0.25, splunk: 0.25 },

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
      isRunning: false,
      activeIncidents: [],
      log: [],
      monitorTrend: [],
      
      // --- Profile Slice Defaults ---
      profiles: [],
      activeProfileId: null,

      // --- Actions ---
      setCredentials: (creds) => set((state) => ({ ...state, ...creds })),
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
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
          const data = await api.getTeams({ token: apiToken, fromEmail });
          // Filter out hidden teams from original App.jsx logic
          const HIDDEN_TEAM_PREFIXES = ["NOC - ", "SRE - "];
          const visibleTeams = data.teams.filter((team: Team) => !HIDDEN_TEAM_PREFIXES.some((prefix) => team.name?.startsWith(prefix)));
          set({ teams: visibleTeams, isLoadingTeams: false });
          get().addLog(`Loaded ${visibleTeams.length} teams.`);
        } catch (error: any) {
          get().addLog(`Failed to load teams: ${error.message}`, 'error');
          set({ isLoadingTeams: false });
        }
      },

      fetchServices: async () => {
        set({ isLoadingServices: true });
        try {
          const { selectedTeamIds, services: currentServices, apiToken, fromEmail } = get();
          // Ensure apiToken is set before making the call
          if (!apiToken) {
            get().addLog('API Token is missing, cannot fetch services.', 'warn');
            set({ isLoadingServices: false });
            return;
          }
          const data = await api.getServices(selectedTeamIds, { token: apiToken, fromEmail });
          const servicesWithInclude = data.services.map((svc: Service) => ({
            ...svc,
            include: currentServices.find(s => s.id === svc.id)?.include || false, // Preserve existing 'include' status
          }));
          set({ services: servicesWithInclude, isLoadingServices: false });
          get().addLog(`Loaded ${servicesWithInclude.length} services.`);
        } catch (error: any) {
          get().addLog(`Failed to load services: ${error.message}`, 'error');
          set({ isLoadingServices: false });
        }
      },

      fetchEscalationPolicies: async () => {
        set({ isLoadingEscalationPolicies: true });
        try {
          const { selectedTeamIds, apiToken, fromEmail } = get();
          // Ensure apiToken is set before making the call
          if (!apiToken) {
            get().addLog('API Token is missing, cannot fetch escalation policies.', 'warn');
            set({ isLoadingEscalationPolicies: false });
            return;
          }
          const data = await api.getEscalationPolicies(selectedTeamIds, { token: apiToken, fromEmail });
          set({ escalationPolicies: data.escalation_policies, isLoadingEscalationPolicies: false });
          get().addLog(`Loaded ${data.escalation_policies.length} escalation policies.`);
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
              payloadString: JSON.stringify(i.payload), // Convert back to string for compatibility
              eventAction: i.eventAction,
              eventType: i.eventType,
              dedupKey: i.dedupKey,
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
        get().addLog(`Triggering imported campaign "${campaign.name}" (${campaign.items.length} steps).`, 'info');
        // This is a complex async operation involving timers and API calls.
        // For now, we'll just log and let the CampaignManager handle the actual dispatch.
        // Detailed implementation to follow when integrating with CampaignManager.
        for (const item of campaign.items) {
          // Simulate delays
          await new Promise(resolve => setTimeout(resolve, item.delaySeconds * 1000));
          get().addLog(`  -> Dispatching step ${item.id} (type: ${item.eventType}).`, 'info');
          // In real implementation, this would call api.triggerEvent or api.triggerChangeEvent
        }
        get().addLog(`Campaign "${campaign.name}" dispatched.`, 'info');
      },
      setLastChangeEvent: (event) => set({ lastChangeEvent: event }),
      
      startSimulation: () => set({ isRunning: true }),
      stopSimulation: () => set({ isRunning: false }),
      
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

      evalTick: () => {
        // This is where periodic evaluation logic (e.g., auto-ack, auto-resolve) will live.
        // It will iterate through activeIncidents and trigger actions based on their nextEvalAt.
        // For now, it just adds a log entry to show it's working.
        get().addLog('Simulation evaluation tick.', 'info');
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
        noteProbability: state.noteProbability,
        responderProbabilityMultiplier: state.responderProbabilityMultiplier,
        autoResolveMinSec: state.autoResolveMinSec,
        autoResolveMaxSec: state.autoResolveMaxSec,
        severityWeights: state.severityWeights,
        autoHealConfig: state.autoHealConfig,
        resumeExistingEnabled: state.resumeExistingEnabled,
        sourceMix: state.sourceMix,
      }),
    }
  )
);
