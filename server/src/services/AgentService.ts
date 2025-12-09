import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

// --- State Definition ---
interface AgentState {
  userRequest: string;
  planSummary?: string;
  finalCampaign?: any;
  provider?: 'google' | 'openai';
}

// --- Agent Service ---
export class AgentService {
  
  private getModel(provider: 'google' | 'openai', type: 'fast' | 'smart') {
      if (provider === 'openai') {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
          
          return new ChatOpenAI({
              modelName: type === 'smart' ? "gpt-4o" : "gpt-4o-mini",
              temperature: type === 'smart' ? 0.4 : 0.7,
              apiKey
          });
      } else {
          // Default to Google
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

          return new ChatGoogleGenerativeAI({
              model: type === 'smart' ? "gemini-2.5-pro" : "gemini-2.5-flash",
              maxOutputTokens: type === 'smart' ? 8192 : 2048,
              temperature: type === 'smart' ? 0.4 : 0.7,
              apiKey
          });
      }
  }

  // --- Nodes ---

  // Node 1: Planner (Uses Smart Model for Reasoning)
  private async plannerNode(state: AgentState, config?: RunnableConfig): Promise<Partial<AgentState>> {
    const provider = state.provider || 'google';
    const model = this.getModel(provider, 'smart');

    const prompt = `
      You are a Principal Solution Consultant at PagerDuty. Your goal is to design a failure scenario that perfectly demonstrates the 'Operations Cloud' value proposition.
      The scenario MUST follow this 4-stage narrative arc:
      1. **Signal Complexity (Minor Incident):** Start with a technical alert (e.g., Storage Full, High CPU) that is auto-grouped. It should look like a background system issue (P5/P4).
         - *Key Artifact:* Include a 'FinOps' or 'Governance' constraint (e.g., 'Auto-scaling blocked by policy').
      2. **Business Impact (Major Incident):** The minor issue escalates. It must cascade to a second, consumer-facing service (e.g., Checkout, Mobile App).
         - *Key Artifact:* High Latency or 500 Errors.
      3. **Triage & Context:** The scenario requires a 'Change Event' to explain the root cause or a 'Related Incident'.
      4. **Resolution:** The scenario ends with a 'Fix' event (e.g., a Change Event showing a rollback or a config override).

      **Timing Rules:**
      - The demo is fast-paced. Events must occur continuously.
      - Maximum gap between events: 5 minutes.
      - Total duration: 15-30 minutes.

      Analyze the user's request: '${state.userRequest}'.
      Return a structured plan summary (TL;DR) explaining how this specific request fits into that 4-stage PagerDuty demo arc.
    `;

    try {
        const response = await model.invoke(prompt);
        const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        return { planSummary: text };
    } catch (error: any) {
        console.error("Planner Node Failed:", error);
        throw new Error(`Planner failed (${provider}): ${error.message}`);
    }
  }

  // Node 2: Builder (Uses Smart Model for structured Code)
  private async builderNode(state: AgentState, config?: RunnableConfig): Promise<Partial<AgentState>> {
    const provider = state.provider || 'google';
    
    // Override model name for OpenAI if provider is openai
    const model = provider === 'openai' 
        ? new ChatOpenAI({
              modelName: "gpt-5.1", // As requested
              temperature: 0.4,
              apiKey: process.env.OPENAI_API_KEY
          })
        : this.getModel(provider, 'smart');

    const basePrompt = `
      You are a Chaos Engineering Architect.
      User Request: "${state.userRequest}"
      Approved Plan: "${state.planSummary}"

      Task: Generate the comprehensive JSON configuration for this campaign.
      
      Requirements:
      1. **Multi-Service:** You MUST generate events for at least 2 distinct services (e.g., 'Database' and 'API Gateway'). Use the \`service\` field in each item to distinguish them (string name).
      2. **Event Types:**
         - **Alerts:** Standard failures.
         - **Change Events:** (CRITICAL) You must include at least one 'Change Event' (e.g., 'Deploy Started', 'FinOps Policy Applied', 'Config Sync'). Set \`eventType: "change"\` in the item if applicable.
      3. **Timing:** Calculate \`delaySeconds\` so events fire sequentially with 1-5 minute gaps.
      4. **Payloads:** Use Mustache tokens (\`{{faker.internet.ip}}\`, \`{{faker.date.recent}}\`) for realism.
      5. **Team Persona:** Ensure the text in the payloads matches the request (e.g., 'Retail', 'Banking').
      6. REPETITION: If an event represents a flood or ongoing issue, set "repeatCount" to 2-5.
    `;

    try {
        let campaign: any;

        if (provider === 'openai') {
            // Use Structured Outputs for robustness
            const schema = z.object({
                name: z.string().describe("The name of the campaign"),
                description: z.string().describe("A brief description of the scenario"),
                items: z.array(z.object({
                    stepName: z.string(),
                    service: z.string().describe("The name of the service affected (e.g. 'Checkout API')"),
                    delaySeconds: z.number(),
                    repeatCount: z.number().optional().default(1),
                    eventType: z.enum(['incident', 'change']),
                    severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
                    payload: z.record(z.string(), z.any()).describe("The PagerDuty event payload (summary, source, custom_details, etc)"),
                    slackMessageTemplate: z.string().optional()
                }))
            });

            const structuredModel = (model as ChatOpenAI).withStructuredOutput(schema);
            campaign = await structuredModel.invoke(basePrompt);

        } else {
            // Google / Prompt Engineering Fallback
            const prompt = `
              ${basePrompt}

              **Output Format:**
              The output must be a valid JSON object matching this structure:
              { 
                "name": "Scenario Name", 
                "description": "Brief description", 
                "items": [
                  { 
                    "stepName": "High Latency Alert",
                    "service": "Checkout Service",
                    "delaySeconds": 0, 
                    "repeatCount": 1, 
                    "eventType": "incident", 
                    "severity": "error", 
                    "payload": { 
                      "summary": "...", 
                      "source": "...", 
                      "custom_details": { ... } 
                    },
                    "slackMessageTemplate": "Slack alert..."
                  }
                ] 
              }
              
              Output ONLY the raw JSON. No markdown fences.
            `;
            
            const response = await model.invoke(prompt);
            let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            campaign = JSON.parse(text);
        }

        return { finalCampaign: campaign };
    } catch (error: any) {
        console.error("Builder Node Failed:", error);
        throw new Error(`Builder failed (${provider}): ${error.message}`);
    }
  }

  // --- Public Methods (Workflows) ---

  public async generateProposal(prompt: string, provider: 'google' | 'openai' = 'google'): Promise<string> {
    // Workflow: START -> plannerNode -> END
    const graph = new StateGraph<AgentState>({
        channels: {
            userRequest: null,
            planSummary: null,
            finalCampaign: null,
            provider: null
        }
    })
      .addNode("planner", this.plannerNode.bind(this))
      .addEdge(START, "planner")
      .addEdge("planner", END);

    const app = graph.compile();
    
    // START is implicitly the entry point
    const result = await app.invoke({ userRequest: prompt, provider });
    
    if (!result.planSummary) throw new Error("No plan generated");
    return result.planSummary as string;
  }

  public async buildCampaign(prompt: string, approvedPlan?: string, provider: 'google' | 'openai' = 'google'): Promise<any> {
    // If no plan provided, we could optionally run the planner first.
    // But typically the UI passes the plan back. If not, we generate a quick one or skip.
    // For now, let's assume if no plan is provided, we just ask the builder to infer it.
    
    const plan = approvedPlan || "Proceed with standard best practices for this scenario.";

    // Workflow: START -> builderNode -> END
    const graph = new StateGraph<AgentState>({
         channels: {
            userRequest: null,
            planSummary: null,
            finalCampaign: null,
            provider: null
        }
    })
      .addNode("builder", this.builderNode.bind(this))
      .addEdge(START, "builder")
      .addEdge("builder", END);

    const app = graph.compile();

    const result = await app.invoke({ userRequest: prompt, planSummary: plan, provider });
    
    if (!result.finalCampaign) throw new Error("No campaign generated");
    return result.finalCampaign;
  }
}

export const agentService = new AgentService();
