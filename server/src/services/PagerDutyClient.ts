import fetch from 'node-fetch';
import { Agent } from 'http'; // For optional proxy

interface PagerDutyClientConfig {
  apiToken: string;
  fromEmail: string;
  apiBase?: string;
}

export class PagerDutyClient {
  private config: PagerDutyClientConfig;
  private httpAgent?: Agent;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 200; // 5 requests per second max

  constructor(config: PagerDutyClientConfig) {
    this.config = {
      apiBase: 'https://api.pagerduty.com',
      ...config
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

  private async request(method: string, path: string, body?: any, queryParams?: URLSearchParams) {
    await this.throttle(); // Simple throttling

    const url = new URL(`${this.config.apiBase}${path}`);
    if (queryParams) {
      queryParams.forEach((value, key) => url.searchParams.append(key, value));
    }

    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.pagerduty+json;version=2',
      'Authorization': `Token token=${this.config.apiToken}`,
      'From': this.config.fromEmail,
    };

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // agent: this.httpAgent, // Uncomment if using proxy
    };

    const res = await fetch(url.toString(), options);

    if (res.status === 429) {
        // Hit rate limit, simple retry after 2s
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.request(method, path, body, queryParams);
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `PagerDuty API Error: ${res.statusText}`);
    }
    return res.json();
  }

  // --- REST API V2 ---
  async getIncidentByDedupKey(dedupKey: string) {
    const params = new URLSearchParams({ incident_key: dedupKey });
    return this.request('GET', '/incidents', undefined, params);
  }

  async manageIncident(incidentId: string, action: 'acknowledge' | 'resolve') {
    return this.request('PUT', `/incidents/${incidentId}`, {
      incident: {
        type: 'incident_reference',
        status: action === 'acknowledge' ? 'acknowledged' : 'resolved'
      }
    });
  }

  async manageIncidentsBatch(incidentIds: string[], action: 'acknowledge' | 'resolve') {
    if (incidentIds.length === 0) return;
    
    const chunks = [];
    const chunkSize = 25; 
    for (let i = 0; i < incidentIds.length; i += chunkSize) {
        chunks.push(incidentIds.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
        const incidents = chunk.map(id => ({
            id,
            type: 'incident_reference',
            status: action === 'acknowledge' ? 'acknowledged' : 'resolved'
        }));
        
        await this.request('PUT', '/incidents', { incidents });
    }
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

  // --- Events API V2 (Unauthenticated, uses routing key) ---
  // These do NOT use apiToken or fromEmail headers
  async triggerEvent(eventBody: any) {
    const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `PagerDuty Events API Error: ${res.statusText}`);
    }
    return res.json();
  }

  async triggerChangeEvent(eventBody: any) {
    const res = await fetch('https://events.pagerduty.com/v2/change/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `PagerDuty Change Events API Error: ${res.statusText}`);
    }
    return res.json();
  }
}
