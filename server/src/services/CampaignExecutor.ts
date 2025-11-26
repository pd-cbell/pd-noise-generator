import fetch from 'node-fetch';
import { Campaign, CampaignItem } from '@prisma/client';

interface ExecutionConfig {
  globalRoutingKey?: string;
  changeRoutingKey?: string;
}

export class CampaignExecutor {
  private config: ExecutionConfig;

  constructor(config: ExecutionConfig) {
    this.config = config;
  }

  async run(campaign: Campaign & { items: CampaignItem[] }) {
    console.log(`[Executor] Starting campaign "${campaign.name}" via Webhook.`);
    
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
          console.error(`[Executor] Step "${item.stepName || item.id}" failed:`, error.message);
        }
      }
    }
    console.log(`[Executor] Campaign "${campaign.name}" completed.`);
  }

  private async executeStep(item: CampaignItem, campaign: Campaign) {
    const payload = item.payload as any;
    
    if (item.eventType === 'incident') {
      // Priority: Campaign Default > Webhook Header > Error
      const routingKey = campaign.integrationKey || this.config.globalRoutingKey;

      if (!routingKey) {
        throw new Error("Missing routing key for incident event (checked campaign default and webhook headers)");
      }

      const body = {
        routing_key: routingKey,
        event_action: item.eventAction || 'trigger',
        dedup_key: item.dedupKey || undefined, // PD assigns if undefined
        payload: {
          ...payload,
          source: payload.source || 'pd-noise-simulator-webhook',
        }
      };

      await this.sendEvent('https://events.pagerduty.com/v2/enqueue', body);
      
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
