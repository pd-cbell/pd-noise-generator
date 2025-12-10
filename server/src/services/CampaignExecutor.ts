import fetch from 'node-fetch';
import { Campaign, CampaignItem } from '@prisma/client';
import { TemplateParser } from '../utils/TemplateParser';
import { SimulationInstance } from './ServerSimulationEngine';

interface ExecutionConfig {
  globalRoutingKey?: string;
  changeRoutingKey?: string;
}

export class CampaignExecutor {
  private config: ExecutionConfig;
  private simInstance?: SimulationInstance;

  constructor(config: ExecutionConfig, simInstance?: SimulationInstance) {
    this.config = config;
    this.simInstance = simInstance;
  }

  async run(campaign: Campaign & { items: CampaignItem[] }) {
    const msg = `[Executor] Starting campaign "${campaign.name}" via Webhook.`;
    console.log(msg);
    if (this.simInstance) this.simInstance.addLog(msg, 'info');
    
    // Sort items by order just in case
    const items = campaign.items.sort((a, b) => a.order - b.order);

    for (const item of items) {
      // Initial Delay
      if (item.delaySeconds > 0) {
        await this.delay(item.delaySeconds * 1000);
      }

      // Repeat Loop
      for (let i = 0; i < item.repeatCount; i++) {
        if (i > 0 && item.intervalSeconds > 0) {
          await this.delay(item.intervalSeconds * 1000);
        }

        try {
          await this.executeStep(item, campaign);
        } catch (error: any) {
          const errMsg = `[Executor] Step "${item.stepName || item.id}" failed: ${error.message}`;
          console.error(errMsg);
          if (this.simInstance) this.simInstance.addLog(errMsg, 'error');
        }
      }
    }
    const doneMsg = `[Executor] Campaign "${campaign.name}" completed.`;
    console.log(doneMsg);
    if (this.simInstance) this.simInstance.addLog(doneMsg, 'info');
  }

  private async executeStep(item: CampaignItem, campaign: Campaign) {
    const rawPayload = item.payload as any;
    const payload = TemplateParser.parseObject(rawPayload);
    const stepLabel = item.stepName || item.id;

    // PagerDuty requires a non-empty summary; add a fallback if missing/blank.
    const summaryFallback = stepLabel || campaign.name || 'PD Noise Simulator Campaign';
    if (!payload.summary || String(payload.summary).trim().length === 0) {
      payload.summary = summaryFallback;
    }
    // Add a small marker to help debugging webhook runs.
    payload.custom_details = {
      ...(payload.custom_details || {}),
      pdns_webhook: true,
      campaign: campaign.name,
      step: stepLabel
    };

    const eventType = (item.eventType || '').toLowerCase();

    if (eventType === 'incident' || eventType === 'alert') {
      // Priority: Item override > Campaign default > Webhook header/global
      const routingKey = item.integrationKey || campaign.integrationKey || this.config.globalRoutingKey;

      if (!routingKey) {
        throw new Error("Missing routing key for incident event (checked item, campaign default, webhook headers)");
      }
      // PagerDuty requires severity for incident events; default to error if missing.
      if (!payload.severity || String(payload.severity).trim().length === 0) {
        payload.severity = 'error';
      }

      const body = {
        routing_key: routingKey,
        event_action: item.eventAction || 'trigger',
        dedup_key: item.dedupKey ? TemplateParser.parse(item.dedupKey) : undefined, // Also parse dedupKey if present
        payload: {
          ...payload,
          source: payload.source || 'pd-noise-simulator-webhook',
        }
      };

      console.log(`[Executor] Sending incident "${stepLabel}" with key ${routingKey}`);
      this.simInstance?.addLog(`Campaign: sending incident "${stepLabel}"`, 'info');
      await this.sendEvent('https://events.pagerduty.com/v2/enqueue', body);
      if (this.simInstance) {
          this.simInstance.state.totalEvents++;
          this.simInstance.addLog(`Campaign: Fired incident step "${stepLabel}"`, 'info');
      }
      
    } else if (eventType === 'change') {
      // Priority: Item override > Campaign default > Webhook header/global
      const routingKey = item.integrationKey || campaign.integrationKey || this.config.changeRoutingKey;
      
      if (!routingKey) {
        throw new Error("Missing routing key for change event (checked item, campaign default, webhook headers)");
      }

      const body = {
        routing_key: routingKey,
        payload: {
          ...payload,
          source: payload.source || 'pd-noise-simulator-webhook',
        }
      };

      console.log(`[Executor] Sending change "${stepLabel}" with key ${routingKey}`);
      this.simInstance?.addLog(`Campaign: sending change "${stepLabel}"`, 'info');
      await this.sendEvent('https://events.pagerduty.com/v2/change/enqueue', body);
      if (this.simInstance) {
          this.simInstance.state.totalEvents++;
          this.simInstance.addLog(`Campaign: Fired change step "${stepLabel}"`, 'info');
      }
    } else {
      console.warn(`[Executor] Skipping step "${stepLabel}" due to unsupported event type "${item.eventType}"`);
      this.simInstance?.addLog(`Campaign: skipped step "${stepLabel}" (unsupported type ${item.eventType})`, 'warn');
    }
  }

  private async sendEvent(url: string, body: any) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PD API ${res.status}: ${errText}`);
    }
    
    // Optional: Log success
    // const data = await res.json();
    // console.log(`[Executor] Event sent. Dedup: ${data.dedup_key}`);
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
