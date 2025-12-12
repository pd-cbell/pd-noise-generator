import { useStore, ImportedCampaign } from '../store/useStore';

export async function fetchFromProxy(url: string, options: RequestInit = {}) {
  // Track API call
  useStore.getState().incrementApiCount();

  const res = await fetch(url, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `API Error: ${res.statusText}`);
  }
  return res.json();
}

export interface ApiConfig {
  token?: string;
  fromEmail?: string;
}

export interface AgentBuildParams { 
    prompt: string; 
    provider?: string; 
    approvedPlan?: string;
    services?: any[];
    eventCount?: number;
    changeCount?: number;
    // GoldenDemo Metadata
    goldenDemoName: string;
    vertical: string;
    maturityLevel: string;
    narrative: string;
    personaNotes?: string;
    createdByUserId: string;
}

function getHeaders(config?: ApiConfig) {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (config?.token) {
    headers['Authorization'] = `Token token=${config.token}`;
  }
  if (config?.fromEmail) {
    headers['From'] = config.fromEmail;
  }
  return headers;
}

export const api = {
  getTeams: (config?: ApiConfig, limit = 100, offset = 0) => 
    fetchFromProxy(`/proxy/teams?limit=${limit}&offset=${offset}`, {
      headers: getHeaders(config)
    }),

  // --- Mapping Profiles ---
  getMappingProfiles: () => fetchFromProxy('/api/mapping-profiles'),
  getMappingProfile: (id: string) => fetchFromProxy(`/api/mapping-profiles/${id}`),
  createMappingProfile: (profile: {
    name: string;
    description?: string | null;
    globalIncidentRoutingKey?: string | null;
    serviceMappings?: any[];
  }) =>
    fetchFromProxy('/api/mapping-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }),
  updateMappingProfile: (id: string, profile: {
    name?: string;
    description?: string | null;
    globalIncidentRoutingKey?: string | null;
    serviceMappings?: any[];
  }) =>
    fetchFromProxy(`/api/mapping-profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }),
  deleteMappingProfile: (id: string) =>
    fetchFromProxy(`/api/mapping-profiles/${id}`, {
      method: 'DELETE',
    }),
    
  getServices: (teamIds: string[] = [], config?: ApiConfig, limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'include[]': 'integrations',
    });
    teamIds.forEach(id => params.append('team_ids[]', id));
    return fetchFromProxy(`/proxy/services?${params.toString()}&include[]=teams`, {
      headers: getHeaders(config)
    });
  },

  getEscalationPolicies: (teamIds: string[] = [], config?: ApiConfig, limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'include[]': 'teams',
    });
    teamIds.forEach(id => params.append('team_ids[]', id));
    return fetchFromProxy(`/proxy/escalation_policies?${params.toString()}`, {
      headers: getHeaders(config)
    });
  },

  getIncidents: (serviceIds: string[], config?: ApiConfig, statuses = ['triggered', 'acknowledged'], limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    serviceIds.forEach(id => params.append('service_ids[]', id));
    statuses.forEach(s => params.append('statuses[]', s));
    return fetchFromProxy(`/proxy/incidents?${params.toString()}`, {
      headers: getHeaders(config)
    });
  },

  getIncidentByDedupKey: (dedupKey: string, config?: ApiConfig) => {
    const params = new URLSearchParams({
      incident_key: dedupKey,
    });
    return fetchFromProxy(`/proxy/incidents?${params.toString()}`, {
      headers: getHeaders(config)
    });
  },

  triggerEvent: (body: any) => 
    fetchFromProxy('/proxy/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  triggerChangeEvent: (body: any) =>
    fetchFromProxy('/proxy/change_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    
  resolveUser: (email: string, config?: ApiConfig) => 
    fetchFromProxy(`/proxy/users?query=${encodeURIComponent(email)}&limit=25`, {
      headers: getHeaders(config)
    }),

  requestResponder: (incidentId: string, body: any, config?: ApiConfig) =>
    fetchFromProxy(`/proxy/incidents/${incidentId}/responder_requests`, {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify(body),
    }),

  addNote: (incidentId: string, content: string, config?: ApiConfig) =>
    fetchFromProxy(`/proxy/incidents/${incidentId}/notes`, {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify({ note: { content } }),
    }),

  // --- Profiles ---
  getProfiles: () => fetchFromProxy('/api/profiles'),

  createProfile: (profile: { name: string; description?: string; settings: any }) =>
    fetchFromProxy('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }),

  updateProfile: (id: string, profile: { name?: string; description?: string; settings?: any }) =>
    fetchFromProxy(`/api/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }),

  deleteProfile: (id: string) =>
    fetchFromProxy(`/api/profiles/${id}`, {
      method: 'DELETE',
    }),

  // --- Incidents ---
  manageIncident: (incidentId: string, fromEmail: string, action: 'acknowledge' | 'resolve', token: string) => 
    fetchFromProxy(`/proxy/incidents/${incidentId}`, {
      method: 'PUT',
      headers: getHeaders({ token, fromEmail }),
      body: JSON.stringify({
        incident: {
          type: 'incident',
          status: action === 'acknowledge' ? 'acknowledged' : 'resolved'
        }
      })
    }),

  // --- Campaigns ---
  getCampaigns: () => fetchFromProxy('/api/campaigns'),

  createCampaign: (campaign: Omit<ImportedCampaign, 'id' | 'source'>) =>
    fetchFromProxy('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    }),

  updateCampaign: (id: string, campaign: Partial<Omit<ImportedCampaign, 'id' | 'source'>>) =>
    fetchFromProxy(`/api/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    }),

  triggerCampaign: (id: string, opts?: { routingKey?: string | null; changeRoutingKey?: string | null }) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts?.routingKey) headers['x-pd-routing-key'] = opts.routingKey;
    if (opts?.changeRoutingKey) headers['x-pd-change-routing-key'] = opts.changeRoutingKey;

    return fetchFromProxy(`/api/campaigns/${id}/trigger`, {
      method: 'POST',
      headers,
    });
  },

  deleteCampaign: (id: string) =>
    fetchFromProxy(`/api/campaigns/${id}`, {
      method: 'DELETE',
    }),

  importCampaigns: (json: any) =>
    fetchFromProxy('/api/campaigns/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    }),

  // --- Agent ---
  agentProposal: (data: { 
      prompt: string; 
      provider?: string; 
      services?: any[]; 
      vertical?: string; 
      maturityLevel?: string; 
  }) => 
    fetchFromProxy('/api/agent/proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          prompt: data.prompt, 
          provider: data.provider || 'google',
          services: data.services,
          vertical: data.vertical,
          maturityLevel: data.maturityLevel
      }),
    }),


  
    agentBuild: (params: AgentBuildParams) =>
      fetchFromProxy('/api/agent/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            prompt: params.prompt, 
            provider: params.provider || 'google', 
            approvedPlan: params.approvedPlan,
            services: params.services || [],
            eventCount: params.eventCount,
            changeCount: params.changeCount,
            // GoldenDemo Metadata
            goldenDemoName: params.goldenDemoName,
            vertical: params.vertical,
            maturityLevel: params.maturityLevel,
            narrative: params.narrative,
            personaNotes: params.personaNotes,
            createdByUserId: params.createdByUserId,
        }),
      }),
  // --- Golden Demos ---
  getGoldenDemos: (vertical?: string) =>
    fetchFromProxy(`/api/golden-demos${vertical ? `?vertical=${vertical}` : ''}`),

  getGoldenDemo: (id: string) =>
    fetchFromProxy(`/api/golden-demos/${id}`),

  createGoldenDemo: (goldenDemo: {
    name: string;
    vertical: string;
    maturityLevel: string;
    narrative: string;
    configJson: any; // Using any for now, will refine with types.ts GoldenDemoConfig
    personaNotes?: string;
  }) =>
    fetchFromProxy('/api/golden-demos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goldenDemo),
    }),

  updateGoldenDemo: (id: string, goldenDemo: {
    name?: string;
    vertical?: string;
    maturityLevel?: string;
    narrative?: string;
    configJson?: any;
    personaNotes?: string;
  }) =>
    fetchFromProxy(`/api/golden-demos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goldenDemo),
    }),

  deleteGoldenDemo: (id: string) =>
    fetchFromProxy(`/api/golden-demos/${id}`, {
      method: 'DELETE',
    }),

  // --- Sessions ---
  startSession: (data: { goldenDemoId: string; name?: string; notes?: string }) =>
    fetchFromProxy('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  endSession: (id: string, notes?: string) =>
    fetchFromProxy(`/api/sessions/${id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }),

  getSessions: (goldenDemoId?: string) =>
    fetchFromProxy(`/api/sessions${goldenDemoId ? `?goldenDemoId=${goldenDemoId}` : ''}`),

  // --- Director ---
  getTaxonomyTree: () => fetchFromProxy('/api/taxonomy/domains'),
  
  triggerTemplate: (templateId: string) => 
    fetchFromProxy('/api/simulation/trigger-template', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ templateId }) 
    }),

  previewTemplate: (templateId: string) => 
    fetchFromProxy('/api/simulation/preview-template', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ templateId }) 
    }),
};
