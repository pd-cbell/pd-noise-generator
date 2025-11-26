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

  private async request(method: string, path: string, body?: any, queryParams?: URLSearchParams) {
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

  async addNote(incidentId: string, content: string) {
    return this.request('POST', `/incidents/${incidentId}/notes`, {
      note: {
        content: content
      }
    });
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
