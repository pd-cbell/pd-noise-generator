export async function fetchFromProxy(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  getTeams: (limit = 100, offset = 0) => 
    fetchFromProxy(`/proxy/teams?limit=${limit}&offset=${offset}`),
    
  getServices: (teamIds: string[] = [], limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'include[]': 'integrations',
    });
    teamIds.forEach(id => params.append('team_ids[]', id));
    // Manually appending 'include[]' again if needed, or trusting URLSearchParams
    // Note: 'include[]' key multiple times is standard for Rails/PD APIs
    return fetchFromProxy(`/proxy/services?${params.toString()}&include[]=teams`);
  },

  getEscalationPolicies: (teamIds: string[] = [], limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'include[]': 'teams',
    });
    teamIds.forEach(id => params.append('team_ids[]', id));
    return fetchFromProxy(`/proxy/escalation_policies?${params.toString()}`);
  },

  getIncidents: (serviceIds: string[], statuses = ['triggered', 'acknowledged'], limit = 100, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    serviceIds.forEach(id => params.append('service_ids[]', id));
    statuses.forEach(s => params.append('statuses[]', s));
    return fetchFromProxy(`/proxy/incidents?${params.toString()}`);
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
    
  resolveUser: (email: string) => 
    fetchFromProxy(`/proxy/users?query=${encodeURIComponent(email)}&limit=25`),

  requestResponder: (incidentId: string, body: any) =>
    fetchFromProxy(`/proxy/incidents/${incidentId}/responder_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  addNote: (incidentId: string, content: string) =>
    fetchFromProxy(`/proxy/incidents/${incidentId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
};
