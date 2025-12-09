import fetch from 'node-fetch';

export class IntegrationService {
  
  public async sendSlackMessage(text: string): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.warn("IntegrationService: SLACK_WEBHOOK_URL not set. Skipping Slack notification.");
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error(`IntegrationService: Slack API returned ${response.status} ${response.statusText}`);
      } else {
        console.log("IntegrationService: Slack message sent.");
      }
    } catch (error) {
      console.error("IntegrationService: Failed to send Slack message", error);
    }
  }
}

export const integrationService = new IntegrationService();
