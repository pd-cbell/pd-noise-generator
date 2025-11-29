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
    
    if (item.eventType === 'incident') {
      // Priority: Campaign Default > Webhook Header > Error
      const routingKey = campaign.integrationKey || this.config.globalRoutingKey;

      if (!routingKey) {
        throw new Error("Missing routing key for incident event (checked campaign default and webhook headers)");
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

      await this.sendEvent('https://events.pagerduty.com/v2/enqueue', body);
      if (this.simInstance) {
          this.simInstance.state.totalEvents++;
          this.simInstance.addLog(`Campaign: Fired incident step "${item.stepName}"`, 'info');
      }
      
    } else if (item.eventType === 'change') {
      // Priority: Item Override > Webhook Header > Error
      const routingKey = item.integrationKey || this.config.changeRoutingKey;
      
      if (!routingKey) {
        throw new Error("Missing routing key for change event (checked item override and webhook headers)");
      }

      const body = {
        routing_key: routingKey,
        payload: {
          ...payload,
          source: payload.source || 'pd-noise-simulator-webhook',
        }
      };

      await this.sendEvent('https://events.pagerduty.com/v2/change/enqueue', body);
      if (this.simInstance) {
          this.simInstance.state.totalEvents++;
          this.simInstance.addLog(`Campaign: Fired change step "${item.stepName}"`, 'info');
      }
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
