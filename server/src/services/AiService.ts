import { GoogleGenerativeAI } from "@google/generative-ai";

const GEN_AI_MODEL = "gemini-2.0-flash";

export class AiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: GEN_AI_MODEL });
    } else {
      console.warn("AiService: No GEMINI_API_KEY found. AI features will be disabled.");
    }
  }

  public isEnabled(): boolean {
    return !!this.model;
  }

  /**
   * Generates a batch of incident templates with Slack context.
   * Returns an array of objects: { payload: any, slack_message: string }
   */
  public async generateTemplateBatch(topic: string, count: number): Promise<{ payload: any, slack_message: string }[]> {
    if (!this.model) throw new Error("AI Service not configured");

    const prompt = `
      You are a DevOps simulation engine. Generate an array of ${count} unique, realistic incident scenarios for a service experiencing '${topic}'.
      
      For EACH scenario, generate two things:
      1. A realistic JSON alert payload (Datadog/Splunk/etc style).
      2. A "War Room" style Slack message that a stressed engineer might post when this incident triggers. It should explicitly mention the error found in the payload.

      The output MUST be a valid JSON ARRAY of objects. Each object should follow this structure:
      {
        "payload": {
            "summary": "A short, technical alert summary",
            "source": "monitoring-tool.com",
            "component": "component-name",
            "custom_details": {
              "error_message": "...",
              "stack_trace": "...",
              ... other fields
            },
            "noteTemplates": ["Comment 1", "Comment 2"]
        },
        "slack_message": "Detailed Slack message here..."
      }

      Instructions:
      - Do NOT use markdown code blocks.
      - Return ONLY the raw JSON array.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Cleanup
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
          throw new Error("AI did not return an array");
      }
      return parsed;
    } catch (error) {
      console.error("AiService: Generation failed:", error);
      throw error;
    }
  }
}

export const aiService = new AiService();
