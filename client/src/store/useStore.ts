import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// --- Types (to be moved to a separate types file later) ---
export interface Profile {
  id: string;
  name: string;
  description: string;
  settings: any; // We will strictly type this progressively
  updatedAt: number;
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
  // ... other config fields
  setCredentials: (creds: Partial<ConfigurationState>) => void;
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
      
      // --- Simulation Slice Defaults ---
      isRunning: false,
      activeIncidents: [],
      log: [],
      
      // --- Profile Slice Defaults ---
      profiles: [],
      activeProfileId: null,

      // --- Actions ---
      setCredentials: (creds) => set((state) => ({ ...state, ...creds })),
      
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
      }),
    }
  )
);
