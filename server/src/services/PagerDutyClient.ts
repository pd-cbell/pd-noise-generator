import fetch from 'node-fetch';
import { Agent } from 'http'; // For optional proxy

interface PagerDutyClientConfig {
  apiToken: string;
  fromEmail: string;
  apiBase?: string;
  eventsBase?: string;
  pdRegion?: string;
  onRequest?: () => void;
}

export class PagerDutyClient {
  private config: PagerDutyClientConfig;
  private httpAgent?: Agent;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 200; // 5 requests per second max

  constructor(config: PagerDutyClientConfig) {
    let apiBase = config.apiBase || 'https://api.pagerduty.com';
    let eventsBase = 'https://events.pagerduty.com';
    if (config.pdRegion === 'EU') {
        apiBase = 'https://api.eu.pagerduty.com';
        eventsBase = 'https://events.eu.pagerduty.com';
    } else if (config.pdRegion === 'STAGING') {
        apiBase = 'https://api.pd-staging.com';
        eventsBase = 'https://events.pd-staging.com';
    }

    this.config = {
      ...config,
      apiBase,
      eventsBase,
    };
    // If we ever need proxy
    // if (process.env.HTTP_PROXY) {
    //   this.httpAgent = new Agent({ proxy: new URL(process.env.HTTP_PROXY) });
    // }
  }

  private async throttle() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLast));
    }
    this.lastRequestTime = Date.now();
  }

  private redactRoutingKey(routingKey?: string | null) {
    if (!routingKey) return 'missing';
    const trimmed = routingKey.trim();
    if (trimmed.length <= 8) return `${trimmed}...`;
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  private sanitizeEventBody(body: any) {
    if (!body || typeof body !== 'object') return body;
    const clone = { ...body };
    if ('routing_key' in clone) {
      clone.routing_key = this.redactRoutingKey(clone.routing_key);
    }
    return clone;
  }

  private async request(method: string, path: string, body?: any, queryParams?: URLSearchParams, headersOverride?: Record<string, string>): Promise<any> {
    await this.throttle(); // Simple throttling
    this.config.onRequest?.();

    const url = new URL(`${this.config.apiBase}${path}`);
    if (queryParams) {
      queryParams.forEach((value, key) => url.searchParams.append(key, value));
    }

    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.pagerduty+json;version=2',
      'Authorization': `Token token=${this.config.apiToken}`,
      'From': this.config.fromEmail,
      ...headersOverride // Apply overrides
    };

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // agent: this.httpAgent, // Uncomment if using proxy
    } as RequestInit; // Cast to satisfy mismatched node-fetch types

    let res: any;
    try {
      res = await fetch(url.toString(), options as any);
    } catch (err: any) {
      console.error(`[PagerDutyClient] Request failed ${method} ${path}: ${err?.message || err}`);
      throw err;
    }

    if (res.status === 429) {
        // Hit rate limit, simple retry after 2s
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.request(method, path, body, queryParams, headersOverride);
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(
        `[PagerDutyClient] REST error ${method} ${path} -> ${res.status} ${res.statusText}`,
        JSON.stringify(errorData, null, 2)
      );
      throw new Error(errorData.error?.message || errorData.message || `PagerDuty API Error: ${res.statusText}`);
    }
    return res.json();
  }

  // --- REST API V2 ---
  async getIncidentByDedupKey(dedupKey: string) {
    const params = new URLSearchParams({ incident_key: dedupKey });
    return this.request('GET', '/incidents', undefined, params);
  }

  async getIncidentsByIds(ids: string[]) {
    if (ids.length === 0) return { incidents: [] };
    const params = new URLSearchParams();
    ids.forEach(id => params.append('incident_ids[]', id));
    params.append('statuses[]', 'triggered');
    params.append('statuses[]', 'acknowledged');
    params.append('statuses[]', 'resolved');
    return this.request('GET', '/incidents', undefined, params);
  }

  async manageIncident(incidentId: string, action: 'acknowledge' | 'resolve', fromEmailOverride?: string) {
    const headers = fromEmailOverride ? { 'From': fromEmailOverride } : undefined;
    return this.request('PUT', `/incidents/${incidentId}`, {
      incident: {
        type: 'incident_reference',
        status: action === 'acknowledge' ? 'acknowledged' : 'resolved'
      }
    }, undefined, headers);
  }

  async manageIncidentsBatch(incidentIds: string[], action: 'acknowledge' | 'resolve') {
    if (incidentIds.length === 0) return [];
    
    const chunks = [];
    const chunkSize = 25; 
    for (let i = 0; i < incidentIds.length; i += chunkSize) {
        chunks.push(incidentIds.slice(i, i + chunkSize));
    }

    const results = [];
    for (const chunk of chunks) {
        const incidents = chunk.map(id => ({
            id,
            type: 'incident_reference',
            status: action === 'acknowledge' ? 'acknowledged' : 'resolved'
        }));
        
        try {
            const res = await this.request('PUT', '/incidents', { incidents });
            results.push(res);
        } catch (error) {
            // If a chunk fails, we might want to capture the error but continue other chunks?
            // For now, let's throw so the caller knows something went wrong, 
            // or return the error as part of the results?
            // Roadmap 1.3 implies we need to catch 404/400. The request method throws on error.
            // We will rethrow here and let the caller handle the specific error, or we could map it.
            throw error; 
        }
    }
    return results;
  }

  async mergeIncidents(targetIncidentId: string, sourceIncidentIds: string[]) {
    if (sourceIncidentIds.length === 0) return;
    
    const source_incidents = sourceIncidentIds.map(id => ({
        id,
        type: 'incident_reference'
    }));

    return this.request('PUT', `/incidents/${targetIncidentId}/merge`, {
        source_incidents
    });
  }

  async requestResponder(incidentId: string, requesterId: string, targetId: string, message: string = "Requesting assistance via Simulator") {
    return this.request('POST', `/incidents/${incidentId}/responder_requests`, {
      requester_id: requesterId,
      message,
      responder_request_targets: [
        {
          responder_request_target: {
            id: targetId,
            type: 'user_reference'
          }
        }
      ]
    });
  }

  async addNote(incidentId: string, content: string) {
    return this.request('POST', `/incidents/${incidentId}/notes`, {
      note: {
        content: content
      }
    });
  }

  async getPriorities() {
      return this.request('GET', '/priorities');
  }

  async updateIncidentPriority(incidentId: string, priorityId: string) {
      return this.request('PUT', `/incidents/${incidentId}`, {
          incident: {
              type: 'incident_reference',
              priority: {
                  id: priorityId,
                  type: 'priority_reference'
              }
          }
      });
  }

  async getUserIdsByEmail(emails: string[]) {
      // Simple implementation for now, can be optimized with bulk fetch if needed
      // PD API doesn't support bulk user fetch by email easily without iteration or searching
      // We will do single lookups but they are cached by the caller (ServerSimulationEngine)
      // Or we can implement a search? 'query' param searches name/email.
      return Promise.all(emails.map(async email => {
          try {
              const params = new URLSearchParams({ query: email, limit: '1' });
              const res = await this.request('GET', '/users', undefined, params);
              return res.users?.[0]?.id || null;
          } catch (e) {
              return null;
          }
      }));
  }

  async getOnCallUsers(serviceId: string, teamIds?: string[]) {
    const params = new URLSearchParams();
    params.append('service_ids[]', serviceId);
    params.append('include[]', 'users');
    
    // Filter by teams if provided
    if (teamIds && teamIds.length > 0) {
        teamIds.forEach(tid => params.append('team_ids[]', tid));
    }

    // Only get level 1 (first responders) usually? Or all. Default is all.
    const res = await this.request('GET', '/oncalls', undefined, params);
    
    const emails: string[] = [];
    if (res.oncalls) {
        res.oncalls.forEach((oc: any) => {
            if (oc.user && oc.user.email) {
                emails.push(oc.user.email);
            }
        });
    }
    // Deduplicate
    return [...new Set(emails)];
  }

  // --- Events API V2 (Unauthenticated, uses routing key) ---
  // These do NOT use apiToken or fromEmail headers
  async triggerEvent(eventBody: any) {
    const sanitized = this.sanitizeEventBody(eventBody);
    const res = await fetch(`${this.config.eventsBase}/v2/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.message || (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : JSON.stringify(errorData.errors)) || `PagerDuty Events API Error: ${res.statusText}`;
      console.error('[PagerDutyClient] Event enqueue failed:', JSON.stringify(sanitized, null, 2));
      console.error('[PagerDutyClient] Event API Error:', res.status, res.statusText, JSON.stringify(errorData, null, 2));
      throw new Error(errorMsg);
    }
    return res.json();
  }

  async triggerChangeEvent(eventBody: any) {
    const sanitized = this.sanitizeEventBody(eventBody);
    console.log('[PagerDutyClient] Sending change event:', JSON.stringify(sanitized, null, 2));
    const res = await fetch(`${this.config.eventsBase}/v2/change/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[PagerDutyClient] Change enqueue failed:', JSON.stringify(sanitized, null, 2));
      console.error('[PagerDutyClient] Change Event Error:', res.status, res.statusText, JSON.stringify(errorData, null, 2));
      throw new Error(errorData.message || `PagerDuty Change Events API Error: ${res.statusText}`);
    }
    return res.json();
  }
}
