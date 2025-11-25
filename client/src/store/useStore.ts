import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api'; // Import the API service

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

export interface SimulationState {
  isRunning: boolean;
  activeIncidents: any[]; // To be typed
  log: any[];
  startSimulation: () => void;
  stopSimulation: () => void;
  addLog: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  // ... other runtime actions
}

export interface ConfigurationState {
  apiToken: string;
  pdSubdomain: string;
  fromEmail: string;
  globalRoutingKey: string;
  selectedTeamIds: string[];
  selectedServiceIds: string[]; // Mapped from includeMap
  
  teams: Team[];
  services: Service[];
  escalationPolicies: EscalationPolicy[];
  isLoadingTeams: boolean;
  isLoadingServices: boolean;
  isLoadingEscalationPolicies: boolean;

  setCredentials: (creds: Partial<ConfigurationState>) => void;
  setSelectedTeamIds: (ids: string[]) => void;
  setServiceInclude: (serviceId: string, include: boolean) => void;
  fetchTeams: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchEscalationPolicies: () => Promise<void>;
}

// --- Store Definition ---

interface AppState extends SimulationState, ConfigurationState {
  profiles: Profile[];
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
  saveProfile: (profile: Profile) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Configuration Slice Defaults ---
      apiToken: '',
      pdSubdomain: '',
      fromEmail: '',
      globalRoutingKey: '',
      selectedTeamIds: [],
      selectedServiceIds: [],
      teams: [],
      services: [],
      escalationPolicies: [],
      isLoadingTeams: false,
      isLoadingServices: false,
      isLoadingEscalationPolicies: false,
      
      // --- Simulation Slice Defaults ---
      isRunning: false,
      activeIncidents: [],
      log: [],
      
      // --- Profile Slice Defaults ---
      profiles: [],
      activeProfileId: null,

      // --- Actions ---
      setCredentials: (creds) => set((state) => ({ ...state, ...creds })),
      setSelectedTeamIds: (ids) => set({ selectedTeamIds: ids }),
      setServiceInclude: (serviceId, include) => set((state) => ({
        services: state.services.map(svc => 
          svc.id === serviceId ? { ...svc, include } : svc
        )
      })),

      fetchTeams: async () => {
        set({ isLoadingTeams: true });
        try {
          const data = await api.getTeams();
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
          const { selectedTeamIds, services: currentServices } = get();
          const data = await api.getServices(selectedTeamIds);
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
          const { selectedTeamIds } = get();
          const data = await api.getEscalationPolicies(selectedTeamIds);
          set({ escalationPolicies: data.escalation_policies, isLoadingEscalationPolicies: false });
          get().addLog(`Loaded ${data.escalation_policies.length} escalation policies.`);
        } catch (error: any) {
          get().addLog(`Failed to load escalation policies: ${error.message}`, 'error');
          set({ isLoadingEscalationPolicies: false });
        }
      },
      
      startSimulation: () => set({ isRunning: true }),
      stopSimulation: () => set({ isRunning: false }),
      
      addLog: (msg, type = 'info') => set((state) => ({
        log: [{ ts: new Date().toLocaleTimeString(), type, msg }, ...state.log].slice(0, 800)
      })),

      setActiveProfile: (id) => set({ activeProfileId: id }),
      
      saveProfile: (profile) => set((state) => {
        const exists = state.profiles.find(p => p.id === profile.id);
        const newProfiles = exists 
          ? state.profiles.map(p => p.id === profile.id ? profile : p)
          : [...state.profiles, profile];
        return { profiles: newProfiles, activeProfileId: profile.id };
      }),
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
        // selectedServiceIds will be derived or managed differently, not directly persisted here.
      }),
    }
  )
);
