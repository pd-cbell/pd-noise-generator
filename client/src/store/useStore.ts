import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api'; 
import { GoldenDemo } from '../../../server/src/types'; 
export type { GoldenDemo, Beat } from '../../../server/src/types';

// --- Mapping Profiles ---
export interface ServiceMapping {
  id: string;
  mappingProfileId: string;
  logicalServiceName: string;
  incidentServiceId?: string | null;
  incidentServiceName?: string | null;
  incidentRoutingKeyOverride?: string | null;
  changeServiceId?: string | null;
  changeServiceName?: string | null;
  useIncidentForChange?: boolean;
}

export type ServiceMappingInput = {
  logicalServiceName: string;
  incidentServiceId?: string | null;
  incidentServiceName?: string | null;
  incidentRoutingKeyOverride?: string | null;
  changeServiceId?: string | null;
  changeServiceName?: string | null;
  useIncidentForChange?: boolean;
};

export type TrackRunState = {
  trackRunId: string;
  goldenDemoId?: string | null;
  mappingProfileId?: string | null;
  startedAt: number;
  finishedAt?: number;
  isActive?: boolean;
  sentEvents?: Array<{
    id: string;
    type: string;
    logicalServiceName: string;
    effectiveServiceName?: string;
    dedupKey?: string | null;
    sentAt: number;
    status: 'sent' | 'error';
    error?: string;
  }>;
  incidentsByDedupKey?: Record<string, {
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
  errors?: string[];
};

export interface MappingProfile {
  id: string;
  name: string;
  description?: string | null;
  globalIncidentRoutingKey?: string | null;
  serviceMappings: ServiceMapping[];
  createdAt?: string;
  updatedAt?: string;
}

// --- Types ---
export interface Profile {
  id: string;
  name: string;
  description: string;
  settings: any; 
  updatedAt: number;
}

export interface Team {
  id: string;
  name: string;
  html_url?: string;
  persona?: string; 
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
  include: boolean; 
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
  lastMapAttemptAt?: number; 
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
  prioritySet?: boolean; 
}




export interface SimulationState {
  isGenerating: boolean; 
  isManaging: boolean;   
  activeIncidents: Incident[];
  log: { ts: string; type: 'info' | 'warn' | 'error'; msg: string }[];
  monitorTrend: { ts: number; count: number }[];
  totalEvents: number;
  
  // Metrics
  avgMtta: Record<IncidentSeverity | 'global', number>; 
  avgMttr: Record<IncidentSeverity | 'global', number>; 
  apiRpm: number;
  apiCallsLast60s: number; 
  droppedEvents: number; 

  // Internal Counters 
  _mttaSums: Record<IncidentSeverity | 'global', number>;
  _mttaCounts: Record<IncidentSeverity | 'global', number>;
  _mttrSums: Record<IncidentSeverity | 'global', number>;
  _mttrCounts: Record<IncidentSeverity | 'global', number>;
  _apiCallCount: number;
  _lastRpmCheck: 0;
  _apiCallTimestamps: number[]; 
  
  startSimulation: () => void;
  pauseSimulation: () => void; 
  stopSimulation: () => void; 
  addLog: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (dedupKey: string, updates: Partial<Incident>) => void;
  removeIncident: (dedupKey: string) => void;
  clearActiveIncidents: () => void;
  addMonitorTrendData: (count: number) => void;
  incrementApiCount: () => void;
  evalTick: () => void; 
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
  info: { 
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
  pdRegion: 'US' | 'EU'; 
  selectedTeamIds: string[];
  selectedEPIds: string[];
  
  ratePerMinute: number;
  severityWeights: { info: number; warning: number; error: number; critical: number };
  autoHealConfig: AutoHealConfig;
  resumeExistingEnabled: boolean;
  sourceMix: Record<string, number>;
  burstProbability: number; 
  majorIncidentProbability: number; 
  responderAckRate: number; 
  teamFailureProbability: number; 

  severityConfigs: Record<IncidentSeverity, SeverityConfig>;

  teams: Team[];
  services: Service[];
  escalationPolicies: EscalationPolicy[];
  isLoadingTeams: boolean;
  isLoadingServices: boolean;
  isLoadingEscalationPolicies: boolean;

  lastChangeEvent: { ts: number; serviceName: string; failureSummary: string } | null;

  setCredentials: (creds: Partial<ConfigurationState>) => void;
  setSettings: (settings: Partial<ConfigurationState>) => void;
  setSeverityConfig: (severity: IncidentSeverity, config: Partial<SeverityConfig>) => void; 
  setSelectedTeamIds: (ids: string[]) => void;
  setSelectedEPIds: (ids: string[]) => void;
  setServiceInclude: (serviceId: string, include: boolean) => void;
  fetchTeams: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchEscalationPolicies: () => Promise<void>;

  setLastChangeEvent: (event: { ts: number; serviceName: string; failureSummary: string } | null) => void;
}

interface AppState extends SimulationState, ConfigurationState {
  profiles: Profile[];
  activeProfileId: string | null;
  isLoadingProfiles: boolean;
  fetchProfiles: () => Promise<void>;
  setActiveProfile: (id: string) => void;
  saveProfile: (profile: Profile) => void;
  deleteProfile: (id: string) => Promise<void>;

  goldenDemos: GoldenDemo[]; 
  isLoadingGoldenDemos: boolean; 
  fetchGoldenDemos: (vertical?: string) => Promise<void>;
  createGoldenDemo: (goldenDemo: Omit<GoldenDemo, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'>) => Promise<GoldenDemo>;
  updateGoldenDemo: (id: string, goldenDemo: Partial<Omit<GoldenDemo, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'>>) => Promise<GoldenDemo>;
  deleteGoldenDemo: (id: string) => Promise<void>;
  upsertGoldenDemo: (goldenDemo: GoldenDemo) => void;
  pendingEditGoldenDemoId: string | null;
  requestEditGoldenDemo: (id: string) => void;
  clearEditGoldenDemoRequest: () => void;

  activeSessionId: string | null;
  startSession: (data: { goldenDemoId: string; name?: string; notes?: string }) => Promise<void>;
  endSession: (notes?: string) => Promise<void>;

  mappingProfiles: MappingProfile[];
  selectedMappingProfileId: string | null;
  fetchMappingProfiles: () => Promise<void>;
  isLoadingMappingProfiles: boolean;
  setSelectedMappingProfileId: (id: string | null) => void;
  createMappingProfile: (profile: { name: string; description?: string | null; globalIncidentRoutingKey?: string | null; serviceMappings?: ServiceMappingInput[] }) => Promise<MappingProfile>;
  updateMappingProfile: (id: string, profile: { name?: string; description?: string | null; globalIncidentRoutingKey?: string | null; serviceMappings?: ServiceMappingInput[] }) => Promise<MappingProfile>;
  deleteMappingProfile: (id: string) => Promise<void>;

  trackRunsById: Record<string, TrackRunState>;
  activeTrackRunId: string | null;
  upsertTrackRun: (run: TrackRunState) => void;
  finishTrackRun: (runId: string) => void;
  selectedTrackRunId: string | 'all' | null;
  trackSelectionMode: 'auto' | 'manual';
  setSelectedTrackRunId: (id: string | 'all' | null, mode?: 'auto' | 'manual') => void;
}

const TREND_WINDOW_MS = 15 * 60 * 1000; 

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Configuration Slice Defaults ---
      apiToken: '',
      pdSubdomain: '',
      fromEmail: '',
      globalRoutingKey: '',
      pdRegion: 'US', 
      selectedTeamIds: [],
      selectedEPIds: [],
      
      ratePerMinute: 6,
      severityWeights: { info: 0.2, warning: 0.4, error: 0.25, critical: 0.15 },
      autoHealConfig: DEFAULT_AUTO_HEAL_CONFIG,
      resumeExistingEnabled: true,
      sourceMix: { cloudwatch: 0.25, datadog: 0.25, newrelic: 0.25, splunk: 0.25 },
      burstProbability: 0.5,
      majorIncidentProbability: 0.2, 
      responderAckRate: 0.9,
      teamFailureProbability: 0.01,

      severityConfigs: DEFAULT_SEVERITY_CONFIGS,

      teams: [],
      services: [],
      escalationPolicies: [],
      isLoadingTeams: false,
      isLoadingServices: false,
      isLoadingEscalationPolicies: false,

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
      pendingEditGoldenDemoId: null,

      // --- Mapping Profiles ---
      mappingProfiles: [],
      selectedMappingProfileId: null,
      isLoadingMappingProfiles: false,

      // --- Track Runs ---
      trackRunsById: {},
      activeTrackRunId: null,
      selectedTrackRunId: null,
      trackSelectionMode: 'auto',

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

      addLog: (msg, type = 'info') => set((state) => ({
        log: [{ ts: new Date().toLocaleTimeString(), type, msg }, ...state.log].slice(0, 800)
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

      setLastChangeEvent: (event) => set({ lastChangeEvent: event }),
      
      startSimulation: () => set({ isGenerating: true, isManaging: true }),
      pauseSimulation: () => set({ isGenerating: false, isManaging: true }),
      stopSimulation: () => set({ isGenerating: false, isManaging: false }),
      
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
        // Client-side simulation logic (mostly deprecated/unused if server simulation is active)
      },

      triggerIncident: async (_service: Service, _failureContext: any = null) => {
         // Deprecated client-side logic
      },

      ackIncident: async (_dedupKey: string) => {
         // Deprecated client-side logic
      },

      resolveIncident: async (_dedupKey: string) => {
         // Deprecated client-side logic
      },

      resolveAllIncidents: async () => {
         // Deprecated client-side logic
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      fetchProfiles: async () => {
        set({ isLoadingProfiles: true });
        try {
          const profiles = await api.getProfiles();
          set({ profiles });
        } catch (error: any) {
          get().addLog(`Failed to load profiles: ${error.message}`, 'error');
        } finally {
          set({ isLoadingProfiles: false });
        }
      },
      
      saveProfile: async (profileData) => {
        const { profiles } = get();
        const existing = profileData.id ? profiles.find(p => p.id === profileData.id) : null;
        
        try {
          let savedProfile;
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
          
          await get().fetchProfiles();
          set({ activeProfileId: savedProfile.id });
        } catch (error: any) {
          get().addLog(`Failed to save profile: ${error.message}`, 'error');
        }
      },

      deleteProfile: async (id: string) => {
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
          get().fetchGoldenDemos(); 
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
          get().fetchGoldenDemos(); 
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
          get().fetchGoldenDemos(); 
        } catch (error: any) {
          get().addLog(`Failed to delete Golden Demo: ${error.message}`, 'error');
          throw error;
        }
      },

      upsertGoldenDemo: (goldenDemo) => {
        set((state) => {
          const existingIndex = state.goldenDemos.findIndex((d) => d.id === goldenDemo.id);
          if (existingIndex === -1) {
            return { goldenDemos: [goldenDemo, ...state.goldenDemos] };
          }
          const updated = [...state.goldenDemos];
          updated[existingIndex] = goldenDemo;
          return { goldenDemos: updated };
        });
      },

      requestEditGoldenDemo: (id) => set({ pendingEditGoldenDemoId: id }),
      clearEditGoldenDemoRequest: () => set({ pendingEditGoldenDemoId: null }),

      fetchMappingProfiles: async () => {
        set({ isLoadingMappingProfiles: true });
        try {
          const profiles = await api.getMappingProfiles();
          set({ mappingProfiles: profiles });
          const { selectedMappingProfileId } = get();
          if (selectedMappingProfileId && !profiles.find((p: MappingProfile) => p.id === selectedMappingProfileId)) {
            set({ selectedMappingProfileId: null });
          }
        } catch (error: any) {
          get().addLog(`Failed to load mapping profiles: ${error.message}`, 'error');
        } finally {
          set({ isLoadingMappingProfiles: false });
        }
      },

      setSelectedMappingProfileId: (id) => {
        set({ selectedMappingProfileId: id });
        get().addLog(id ? `Selected mapping profile ${id}` : 'Cleared mapping profile selection', 'info');
      },

      createMappingProfile: async (profileData) => {
        const created = await api.createMappingProfile(profileData);
        const profiles = [...get().mappingProfiles, created];
        set({ mappingProfiles: profiles, selectedMappingProfileId: created.id });
        get().addLog(`Created mapping profile "${created.name}"`, 'info');
        return created;
      },

      updateMappingProfile: async (id, profileData) => {
        const updated = await api.updateMappingProfile(id, profileData);
        const profiles = get().mappingProfiles.map((p) => (p.id === id ? updated : p));
        set({ mappingProfiles: profiles });
        get().addLog(`Updated mapping profile "${updated.name}"`, 'info');
        return updated;
      },

      deleteMappingProfile: async (id) => {
        await api.deleteMappingProfile(id);
        set((state) => ({
          mappingProfiles: state.mappingProfiles.filter((p) => p.id !== id),
          selectedMappingProfileId: state.selectedMappingProfileId === id ? null : state.selectedMappingProfileId,
        }));
        get().addLog('Deleted mapping profile', 'info');
      },

      upsertTrackRun: (run) => {
        set((state) => ({
          trackRunsById: { ...state.trackRunsById, [run.trackRunId]: { ...(state.trackRunsById[run.trackRunId] || {}), ...run } },
          activeTrackRunId: run.trackRunId,
          selectedTrackRunId: state.trackSelectionMode === 'auto' ? run.trackRunId : state.selectedTrackRunId,
        }));
      },

      finishTrackRun: (runId) => {
        set((state) => {
          const existing = state.trackRunsById[runId];
          if (!existing) return state;
          return {
            trackRunsById: {
              ...state.trackRunsById,
              [runId]: { ...existing, isActive: false, finishedAt: existing.finishedAt || Date.now() },
            },
            activeTrackRunId: state.activeTrackRunId === runId ? null : state.activeTrackRunId,
          };
        });
      },

      setSelectedTrackRunId: (id, mode = 'manual') => {
        set(() => ({
          selectedTrackRunId: id,
          trackSelectionMode: mode,
        }));
      },

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
      name: 'pdns-storage', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        apiToken: state.apiToken,
        pdSubdomain: state.pdSubdomain,
        fromEmail: state.fromEmail,
        globalRoutingKey: state.globalRoutingKey,
        pdRegion: state.pdRegion, 
        selectedTeamIds: state.selectedTeamIds,
        mappingProfiles: state.mappingProfiles,
        selectedMappingProfileId: state.selectedMappingProfileId,
        
        ratePerMinute: state.ratePerMinute,
        severityWeights: state.severityWeights,
        autoHealConfig: state.autoHealConfig,
        resumeExistingEnabled: state.resumeExistingEnabled,
        sourceMix: state.sourceMix,
        burstProbability: state.burstProbability,
        majorIncidentProbability: state.majorIncidentProbability,
        responderAckRate: state.responderAckRate,
        teamFailureProbability: state.teamFailureProbability,

        severityConfigs: state.severityConfigs,
      }),
    }
  )
);
