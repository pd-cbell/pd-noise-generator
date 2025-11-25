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
  lastNoteAt: number | null; // Added
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
  totalEvents: number;
  avgMtta: number; // milliseconds
  avgMttr: number; // milliseconds
  _mttaSum: number;
  _mttaCount: number;
  _mttrSum: number;
  _mttrCount: number;
  
  startSimulation: () => void;
  stopSimulation: () => void;
  addLog: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (dedupKey: string, updates: Partial<Incident>) => void;
  removeIncident: (dedupKey: string) => void;
  clearActiveIncidents: () => void;
  addMonitorTrendData: (count: number) => void;
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
      totalEvents: 0,
      avgMtta: 0,
      avgMttr: 0,
      _mttaSum: 0,
      _mttaCount: 0,
      _mttrSum: 0,
      _mttrCount: 0,
      
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
          const allTeams: Team[] = [];
          let offset = 0;
          let more = true;

          while (more) {
            const data = await api.getTeams({ token: apiToken, fromEmail }, 100, offset);
            // Filter out hidden teams from original App.jsx logic
            const HIDDEN_TEAM_PREFIXES = ["NOC - ", "SRE - "];
            const visibleTeams = data.teams.filter((team: Team) => !HIDDEN_TEAM_PREFIXES.some((prefix) => team.name?.startsWith(prefix)));
            allTeams.push(...visibleTeams);
            
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
          const { selectedTeamIds, services: currentServices, apiToken, fromEmail } = get();
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
            const data = await api.getServices(selectedTeamIds, { token: apiToken, fromEmail }, 100, offset);
            
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

      evalTick: async () => {
        // Periodic lifecycle updates (auto-resolve, etc.)
        const { activeIncidents, updateIncident, removeIncident, addLog, apiToken, fromEmail, noteProbability, responderProbabilityMultiplier, ackIncident } = get();
        const now = Date.now();

        // Iterate sequentially or parallel - parallel is fine for resolution checks
        // We need to be careful not to modify state inside the loop in a way that breaks iteration if we were removing,
        // but we are using `forEach` on a snapshot or `map`. 
        // Since `evalTick` is called frequently, we should limit how many API calls we make.
        // Let's resolve only one incident per tick to avoid rate limits if many are pending.
        
        const pendingResolution = activeIncidents.find(inc => !inc.incidentId && (now - inc.startedAt > 4000) && (now - inc.startedAt < 60000)); // Check only recent ones, stop checking after 1m
        
        if (pendingResolution && apiToken) {
           try {
             const response = await api.getIncidentByDedupKey(pendingResolution.dedupKey, { token: apiToken, fromEmail });
             const match = response.incidents?.[0];
             if (match) {
               updateIncident(pendingResolution.dedupKey, { incidentId: match.id });
               // Optional: log success? "Mapped dedupKey to ID..."
             }
           } catch (e) {
             // Ignore
           }
        }

        // Sync checks for auto-resolve/heal and noise generation
        for (const inc of activeIncidents) {
          // Skip if no ID yet
          if (!inc.incidentId) continue;

          // Auto-Resolve Check
          if (inc.resolveAt && now >= inc.resolveAt) {
            // Update MTTR
            const timeToResolve = now - inc.startedAt;
            set((state) => {
                const newCount = state._mttrCount + 1;
                const newSum = state._mttrSum + timeToResolve;
                return { _mttrCount: newCount, _mttrSum: newSum, avgMttr: newSum / newCount };
            });

            removeIncident(inc.dedupKey);
            addLog(`Auto-resolved incident ${inc.dedupKey.substring(0, 8)}...`, 'info');
            
            try {
                if (apiToken) {
                    // Add resolution note
                    await api.addNote(inc.incidentId, `Auto-resolved by simulator (Duration: ${((now - inc.startedAt)/1000).toFixed(0)}s)`, { token: apiToken, fromEmail });
                    // Resolve
                    await api.manageIncident(inc.incidentId, fromEmail, 'resolve', apiToken);
                }
            } catch (e) { /* ignore */ }
            continue; // Done with this one
          }
          
          // Auto-Heal Check (Warning only)
          if (inc.autoHealScheduled && inc.autoHealAt && now >= inc.autoHealAt) {
             // Update MTTR
             const timeToResolve = now - inc.startedAt;
             set((state) => {
                const newCount = state._mttrCount + 1;
                const newSum = state._mttrSum + timeToResolve;
                return { _mttrCount: newCount, _mttrSum: newSum, avgMttr: newSum / newCount };
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
          // If not acked and time > nextEval, small chance to ack
          if (!inc.acked && now > inc.nextEvalAt) {
             // 5% chance per tick to ack if "overdue"
             if (Math.random() < 0.05) {
                 ackIncident(inc.dedupKey);
             }
          }

          // Add Notes
          // Check if enough time passed since last note (e.g. 30s)
          if ((!inc.lastNoteAt || (now - inc.lastNoteAt > 30000)) && Math.random() < (0.05 * noteProbability)) {
             const note = inc.noteContext[Math.floor(Math.random() * inc.noteContext.length)] || "Investigating...";
             try {
                 await api.addNote(inc.incidentId, note, { token: apiToken, fromEmail });
                 updateIncident(inc.dedupKey, { lastNoteAt: now });
                 addLog(`Added note to ${inc.incidentId}: "${note}"`, 'info');
             } catch (e) { /* ignore */ }
          }
        }
      },

      triggerIncident: async (service: Service, failureContext: any = null) => {
        const { sourceMix, globalRoutingKey, severityWeights, autoResolveMinSec, autoResolveMaxSec, autoHealConfig } = get();
        
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
        const severity = (() => {
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
            // (Implementation decision based on legacy behavior)
        }

        const dedupKey = failureContext ? undefined : crypto.randomUUID(); // Let PD assign for campaigns if desired, or generate

        const eventBody = {
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
              generator: 'pd-noise-simulator'
            }
          }
        };

        try {
          const response = await api.triggerEvent(eventBody);
          
          if (severity !== 'info') {
             // Calculate timings
             const now = Date.now();
             const resolveDelay = (Math.min(autoResolveMinSec, autoResolveMaxSec) + Math.random() * Math.abs(autoResolveMaxSec - autoResolveMinSec)) * 1000;
             const shouldAutoHeal = severity === 'warning' && autoHealConfig.enabled && Math.random() < autoHealConfig.warningProbability;
             const autoHealDelay = shouldAutoHeal 
                ? (Math.min(autoHealConfig.minDelaySec, autoHealConfig.maxDelaySec) + Math.random() * Math.abs(autoHealConfig.maxDelaySec - autoHealConfig.minDelaySec)) * 1000 
                : null;

             const newIncident: Incident = {
               dedupKey: response.dedup_key || dedupKey || 'unknown',
               serviceId: service.id,
               serviceName: service.name,
               startedAt: now,
               incidentId: null, // Would need another API call or webhook to get the real ID
               mapAttempts: 0,
               nextEvalAt: now + 10000,
               ackAt: null,
               acked: false,
               firstResponderAt: null,
               responderRequested: false,
               severity,
               resolveAt: now + resolveDelay,
               autoHealAt: autoHealDelay ? now + autoHealDelay : null,
               autoHealScheduled: shouldAutoHeal,
               observabilitySource: payload.source || 'unknown',
               failureId: failureContext?.id || null,
               failureSummary: failureContext?.summary || null,
               noteContext: payload.noteTemplates || [],
               syncedFromPd: false
             };
             
             get().addIncident(newIncident);
             set((state) => ({ totalEvents: state.totalEvents + 1 }));
             get().addLog(`Triggered ${severity} incident for ${service.name}`, 'info');
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
            const newCount = state._mttaCount + 1;
            const newSum = state._mttaSum + timeToAck;
            return {
              _mttaCount: newCount,
              _mttaSum: newSum,
              avgMtta: newSum / newCount
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
            const newCount = state._mttrCount + 1;
            const newSum = state._mttrSum + timeToResolve;
            return {
              _mttrCount: newCount,
              _mttrSum: newSum,
              avgMttr: newSum / newCount
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
