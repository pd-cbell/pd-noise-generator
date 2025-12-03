import fetch from 'node-fetch';

export class IntegrationService {
  private slackWebhookUrl: string | undefined;

  constructor() {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  public async sendSlackNotification(message: string): Promise<void> {
    if (!this.slackWebhookUrl) {
      // console.warn('IntegrationService: No SLACK_WEBHOOK_URL configured. Skipping notification.');
      return;
    }

    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        console.error(`IntegrationService: Failed to post to Slack. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('IntegrationService: Error posting to Slack:', error);
    }
  }
}

export const integrationService = new IntegrationService();
