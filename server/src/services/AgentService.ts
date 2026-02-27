import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { GoldenDemoService } from "./GoldenDemoService";
import { GoldenDemo, Role } from "@prisma/client";

// --- State Definition using Annotation (LangGraph v0.2/v1.0+) ---
const AgentStateAnnotation = Annotation.Root({
  userRequest: Annotation<string>,
  planSummary: Annotation<string | undefined>,
  finalCampaign: Annotation<any>,
  goldenDemoMetadata: Annotation<Partial<GoldenDemo> | undefined>,
  provider: Annotation<'google' | 'openai' | undefined>,
  
  // High-Control Fields
  availableServices: Annotation<any[] | undefined>,
  eventCount: Annotation<number | undefined>,
  changeCount: Annotation<number | undefined>,
  
  // GoldenDemo Metadata
  goldenDemoName: Annotation<string | undefined>,
  goldenDemoIndustry: Annotation<string | undefined>,
  goldenDemoUseCase: Annotation<string | undefined>,
  goldenDemoNarrative: Annotation<string | undefined>,
  goldenDemoPersonaNotes: Annotation<string | undefined>,
  createdByUserId: Annotation<string | undefined>,
});

// Helper type for function signatures
type AgentStateType = typeof AgentStateAnnotation.State;

// --- Agent Service ---
export class AgentService {
  private goldenDemoService: GoldenDemoService;

  constructor(goldenDemoService: GoldenDemoService) {
    this.goldenDemoService = goldenDemoService;
  }
  
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

  private async plannerNode(state: AgentStateType, config?: RunnableConfig): Promise<Partial<AgentStateType>> {
    const provider = state.provider || 'openai';
    const model = this.getModel(provider, 'smart');

    const prompt = `
You are a Principal Solution Consultant at PagerDuty. Your job is to design a compelling failure narrative that demonstrates the value of the PagerDuty Operations Cloud across its full lifecycle.

The user has already provided their scenario input:
- User Request: "${state.userRequest}"
- Industry: "${state.goldenDemoIndustry || 'General'}"      // e.g., Financial Services, Retail, Public Sector
- Use Case: "${state.goldenDemoUseCase || 'Crisis Ops'}"    // e.g., Agent Ops, DORA Compliance, Security Incident Management

You are also given a list of candidate *technical services* from the user’s PagerDuty account:
${state.availableServices ? JSON.stringify(state.availableServices.map(s => s.name)) : 'Any (Assume standard e-commerce stack)'}

These represent the user’s real technical services (often aligned to teams). You MUST choose specific services from this list to anchor the scenario. Refer to them EXACTLY by their names to ensure they can be used later as \`event.custom_details.service_name\`.

---------------------------------------------------------
CORE STORY ARC — MUST FOLLOW THESE 4 STAGES
---------------------------------------------------------

1) Routine Change and Minor Incidents — Where Major Incidents Start
   - A routine, low-risk change is applied to one of the selected technical services.
   - This introduces a subtle degradation that surfaces as a **minor, low-severity technical incident**.
   - The minor issue appears harmless or ignorable (P5/P4 style) but is the key early signal.
   - Describe the early symptoms in a way that fits the user's **industry** and **use case**.
   - Make the narrative clear: *If this had been caught and resolved early, the major incident could have been prevented.*

2) Business Impact — Escalation Driven by Lagging Indicators
   - Time passes. One or more additional routine changes, traffic patterns, or environmental conditions interact with the unresolved minor issue.
   - A major, customer-visible incident emerges.
   - The incident affects a service selected from the technical list, framed as business-critical within the given industry.
   - Symptoms should match the industry and use case framing (e.g., customer impact, compliance exposure, analyst throughput, agent productivity).
   - The escalation must clearly trace back to:
       a) the root routine change, and
       b) the ignored minor incident.

3) Triage & Context — Connecting Signals, Changes, Dependencies, and Services
   - Someone (or PagerDuty’s AIOps / Automation / Service Graph) must connect:
       - the lagging business symptom,
       - the earlier minor incident,
       - the routine change(s) that seemed safe at the time.
   - Describe how PagerDuty provides actionable context through:
       - change events,
       - related incidents,
       - dependency mapping,
       - notes, automation logs, classification, etc.
   - Show how this context accelerates MTTA/MTTR and mobilizes the right teams.

4) Resolution & Post-Incident Review — Every Incident Becomes a Learning Opportunity
   - The incident is resolved through a clear action (rollback, config override, scaling adjustment, feature flag reversal, automation runbook, etc.).
   - Then explicitly describe a **Post-Incident Review (PIR)** that:
       - documents the timeline and root cause,
       - identifies how the minor incident could be detected, escalated, or remediated faster next time,
       - proposes new workflow automations, guardrails, runbook changes, or routing improvements,
       - reflects the user’s **industry** and **use case** (e.g., compliance-driven PIR for Public Sector + DORA Compliance; response-process PIR for Security Incident Management).
   - PIR should feel like a true learning loop that improves reliability and operational readiness.

---------------------------------------------------------
SERVICE SELECTION RULES
---------------------------------------------------------

From the provided list of technical services:

- Choose at least **one primary technical service** to anchor Stage 1 and the originating change.
- Optionally choose a **second service** to act as the downstream “business-impact” surface.
- Select the services that best match the *industry/use case* framing and the user’s *scenario request*.
- Refer to all selected services EXACTLY as they appear in the list (no renaming, no altering, no inventing new ones).

These EXACT names will later populate \`event.custom_details.service_name\`.

---------------------------------------------------------
TIMING GUIDELINES (DEMO-FRIENDLY)
---------------------------------------------------------

- The scenario should “feel” like 15–30 minutes of real operational time.
- No major step should have more than ~5 minutes between key events.
- Maintain pacing that keeps demo audiences engaged.

---------------------------------------------------------
REQUIRED OUTPUT
---------------------------------------------------------

Return a structured planning summary (NOT JSON). Include:

- A concise TL;DR of the full story (2–3 sentences).
- The four narrative stages, each with:
   - Stage title,
   - Selected service(s),
   - A clear description of what happens and why,
   - Industry-specific framing,
   - Use-case-specific goals, blind spots, or operational priorities.
- A short section highlighting:
   - Where PagerDuty’s AIOps, Automation, Change Events, and Service Graph add unique value.
   - How the Post-Incident Review creates a learning and prevention cycle.

Do NOT output JSON in this step. This is narrative planning only.
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

  private async builderNode(state: AgentStateType, config?: RunnableConfig): Promise<Partial<AgentStateType>> {
    const provider = state.provider || 'openai';
    
    // Override model name for OpenAI if provider is openai
    const model = provider === 'openai' 
        ? new ChatOpenAI({
              modelName: "gpt-5.1", // As requested
              temperature: 0.4,
              apiKey: process.env.OPENAI_API_KEY
          })
        : this.getModel(provider, 'smart');

    // Filter services to only basic info to save tokens
    const servicesJson = JSON.stringify(
        state.availableServices?.map(s => ({
            name: s.name, 
            type: s.type || 'technical',
            integrationKey: s.integrationKey ? 'available' : 'missing',
            changeIntegrationKey: s.changeIntegrations?.[0]?.integrationKey ? 'available' : 'missing'
        })) || []
    );

    const basePrompt = `
      You are a Chaos Engineering Architect.
      User Request: "${state.userRequest}"
      Approved Plan: "${state.planSummary}"
      Target Industry: "${state.goldenDemoIndustry || 'General'}"
      Target Use Case: "${state.goldenDemoUseCase || 'Crisis Ops'}"

      Task: Generate the comprehensive JSON configuration for this campaign.
      
      **Constraints (High Control):**
      1. **Service Selection:** You must ONLY generate events for the services listed here: ${servicesJson}. 
         - Map the narrative steps to these specific services logically (e.g., if the narrative says 'Database fails', assign that event to the service typed 'database' or similar in the list).
         - Do not invent new service names. Use the exact "name" from the list.
      2. **Volume:** Generate exactly ${state.eventCount || 10} alert events and ${state.changeCount || 2} change events.
      3. **Key Usage:** 
         - For Alerts, assume the standard integration key is used.
         - For Change Events, you MUST set \`eventType: "change"\`. (Only assign to services that have a 'changeIntegrationKey' available if possible).

      **Narrative Requirements:**
      1. **Multi-Service:** You MUST generate events for at least 2 distinct services from the list.
      2. **Event Types:**
         - **Alerts:** Standard failures.
         - **Change Events:** (CRITICAL) You must include at least one 'Change Event'.
      3. **Timing:** Calculate \`delaySeconds\` so events fire sequentially with 10-150 second gaps.
      4. **Payloads:** Use Mustache tokens (\`{{faker.internet.ip}}\`, \`{{faker.date.recent}}\`) for realism.
      5. **Team Persona:** Ensure the text in the payloads matches the request and the target industry/use-case framing.
      6. REPETITION: If an event represents a flood or ongoing issue, set "repeatCount" to 2-5.
    `;

    try {
        let goldenDemoOutput: any;
        const promptVersion = '2.4.3';
        const modelName = provider === 'openai' ? 'gpt-5.1' : 'gemini-2.5-pro';

        const goldenDemoOutputSchema = z.object({
            name: z.string().describe("The name of the Golden Demo scenario (e.g., 'Black Friday Checkout Failure')"),
            industry: z.string().describe("The industry this demo targets (e.g., 'Retail', 'Financial Services', 'Tech & Telco')"),
            useCase: z.string().describe("The primary use case this demo demonstrates (e.g., 'Crisis Ops', 'Agent Ops', 'DORA Compliance')"),
            narrative: z.string().describe("The full 4-stage Golden Demo narrative, including Signal, Impact, Triage, and Resolution phases, tailored to the user's request."),
            personaNotes: z.string().nullable().describe("Internal notes for the presenter about personas, key talking points, or setup."),
            configJson: z.object({
                name: z.string().describe("The name of the campaign"),
                description: z.string().describe("A brief description of the scenario"),
                beats: z.array(z.object({
                    id: z.string().describe("Unique ID for the beat"),
                    title: z.string().describe("Short title of the beat (e.g., 'Signal Detected')"),
                    description: z.string().describe("Description of what is happening in this stage"),
                    whatToShowInPagerDuty: z.string().describe("Instruction on what specific screen/tab to show in PagerDuty (e.g., 'Show the Service Directory')"),
                    whatToSay: z.string().describe("Script for the presenter to say"),
                    approxTimingSec: z.number().nullable().describe("Approximate timing in seconds for this beat; null if unspecified")
                })).describe("3-5 narrative beats for the presenter script"),
                items: z.array(z.object({
                    stepName: z.string(),
                    service: z.string().describe("The name of the service affected (e.g. 'Checkout API')"),
                    delaySeconds: z.number(),
                    repeatCount: z.number().describe("How many times to repeat this step; use 1 if not repeating"),
                    eventType: z.enum(['incident', 'change']),
                    severity: z.enum(['info', 'warning', 'error', 'critical']).nullable().describe("Severity for incident events; null allowed for change events"),
                    payload: z.object({
                        summary: z.string(),
                        source: z.string(),
                        custom_details: z.object({
                            service_name: z.string().describe("MUST match the item's 'service' field exactly for routing"),
                        }).passthrough()
                    }).passthrough().describe("The PagerDuty event payload"),
                    slackMessageTemplate: z.string().nullable().describe("Optional Slack summary message; null if not provided")
                }))
            })
        });

        if (provider === 'openai') {
            const structuredModel = (model as ChatOpenAI).withStructuredOutput(goldenDemoOutputSchema);
            goldenDemoOutput = await structuredModel.invoke(basePrompt);
        } else {
            const prompt = `
              ${basePrompt}

                    7. **Routing:** You MUST include the field \`service_name\` inside the \`payload.custom_details\` object for EVERY event. The value MUST match the \`service\` name exactly.
                    8. **Beats:** You MUST generate 3-5 'beats' for the presenter script. Each beat needs a title, description, 'whatToShowInPagerDuty', and 'whatToSay'.
              
                    **Output Format:**
                    The output must be a valid JSON object matching this exact structure, including all GoldenDemo metadata fields:
                    ${JSON.stringify(
                        {
                            name: "Generated Golden Demo Name",
                            industry: "Target Industry",
                            useCase: "Target Use Case",
                            narrative: "The detailed 4-stage narrative.",
                            personaNotes: "Notes for the presenter.",
                            configJson: {
                                name: "Campaign Name",
                                description: "Campaign Description",
                                beats: [
                                    {
                                        id: "1",
                                        title: "Signal Detected",
                                        description: "Initial alert arrives",
                                        whatToShowInPagerDuty: "Service Activity screen",
                                        whatToSay: "Here we see the noise...",
                                        approxTimingSec: 60
                                    }
                                ],
                                items: [
                                    {
                                        stepName: "Step Name",
                                        service: "Service Name",
                                        delaySeconds: 0, 
                                        repeatCount: 1, 
                                        eventType: "incident", 
                                        severity: "error", 
                                        payload: {
                                            summary: "Summary", 
                                            source: "Source", 
                                            custom_details: {
                                                service_name: "Service Name"
                                            }
                                        },
                                        slackMessageTemplate: "Slack alert..."
                                    }
                                ]
                            }
                        }, null, 2)}
                    
                    Output ONLY the raw JSON. No markdown fences.            `;
            
            const response = await model.invoke(prompt);
            let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            goldenDemoOutput = JSON.parse(text);
        }

        const items = goldenDemoOutput?.configJson?.items;
        if (Array.isArray(items)) {
            const serviceLookup = new Map(
                (state.availableServices || []).map((svc: any) => [svc.name, svc])
            );

            items.forEach((item: any, idx: number) => {
                const eventType = item.eventType || item.type || 'incident';
                const serviceName =
                    item.service ||
                    item.logicalServiceName ||
                    item.serviceName ||
                    item?.payload?.custom_details?.service_name;

                if (!item.id) {
                    item.id = `step-${idx + 1}`;
                }
                if (!item.logicalServiceName && serviceName) {
                    item.logicalServiceName = serviceName;
                }
                if (!item.service && serviceName) {
                    item.service = serviceName;
                }

                if (eventType === 'change' && serviceName) {
                    const svc = serviceLookup.get(serviceName);
                    const changeKey =
                        item.changeRoutingKey ||
                        item.integrationKey ||
                        svc?.changeIntegrations?.find((integration: any) => integration?.integrationKey)?.integrationKey ||
                        null;
                    if (!item.changeRoutingKey && changeKey) {
                        item.changeRoutingKey = changeKey;
                    }
                }

                const delay = Number(item.delaySeconds ?? item.offsetSeconds ?? 0);
                const clampedDelay = Number.isFinite(delay)
                    ? Math.min(150, Math.max(10, delay))
                    : 10;
                item.delaySeconds = clampedDelay;
                if ('offsetSeconds' in item) {
                    item.offsetSeconds = clampedDelay;
                }

                const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
                const customDetails =
                    payload.custom_details && typeof payload.custom_details === 'object'
                        ? payload.custom_details
                        : {};
                if (serviceName && !customDetails.service_name) {
                    customDetails.service_name = serviceName;
                }
                const detailKeys = Object.keys(customDetails).filter((key) => key !== 'service_name');
                if (detailKeys.length < 3) {
                    if (eventType === 'change') {
                        customDetails.change_id = customDetails.change_id || `CHG-{{faker.number.int(min=10000,max=99999)}}`;
                        customDetails.deployer = customDetails.deployer || '{{faker.person.fullName}}';
                        customDetails.git_sha = customDetails.git_sha || '{{faker.string.alphanumeric(length=8)}}';
                        customDetails.environment = customDetails.environment || 'production';
                        customDetails.version = customDetails.version || 'v{{faker.number.int(min=1,max=3)}}.{{faker.number.int(min=0,max=9)}}.{{faker.number.int(min=0,max=9)}}';
                    } else {
                        customDetails.endpoint = customDetails.endpoint || '/api/v1/{{faker.string.uuid}}';
                        customDetails.observed_ms = customDetails.observed_ms || '{{faker.number.int(min=900,max=2600)}}';
                        customDetails.threshold_ms = customDetails.threshold_ms || '1000';
                        customDetails.active_connections = customDetails.active_connections || '{{faker.number.int(min=120,max=950)}}';
                        customDetails.trace_id = customDetails.trace_id || '{{faker.string.uuid}}';
                    }
                }
                payload.custom_details = customDetails;
                payload.source = payload.source || (eventType === 'change' ? 'GitHub Actions' : 'Datadog-APM-Prod');
                payload.summary = payload.summary || item.stepName || `${serviceName || 'Service'} ${eventType} event`;
                item.payload = payload;
            });
        }

        const summarizeGeneratedItems = (scenarioItems: any[]) => {
            const beats = Array.isArray(goldenDemoOutput?.configJson?.beats)
                ? goldenDemoOutput.configJson.beats
                : [];
            const missingServiceNameCount = scenarioItems.filter(
                (item: any) => !item?.payload?.custom_details?.service_name
            ).length;
            const sparseCustomDetailsCount = scenarioItems.filter((item: any) => {
                const details = item?.payload?.custom_details;
                if (!details || typeof details !== 'object') return true;
                const keys = Object.keys(details).filter((k) => k !== 'service_name');
                return keys.length < 2;
            }).length;
            return {
                eventCount: scenarioItems.length,
                changeCount: scenarioItems.filter((item: any) => item?.eventType === 'change').length,
                beatsCount: beats.length,
                missingServiceNameCount,
                sparseCustomDetailsCount,
            };
        };

        const fullNarrativeSource = state.goldenDemoNarrative || state.planSummary;
        if (fullNarrativeSource) {
            const extractTldr = (text: string) => {
                const sanitize = (value: string) =>
                    value
                        .replace(/^[\s>*-]+/gm, '')
                        .replace(/\*\*/g, '')
                        .replace(/`/g, '')
                        .trim();
                const tldrLine = text.match(/^\s*(?:[-*]\s*)?(?:\*\*)?TL;DR(?:\*\*)?\s*:?\s*(.+)$/im);
                if (tldrLine?.[1]) {
                    const cleaned = sanitize(tldrLine[1]);
                    if (cleaned.length >= 12) return cleaned;
                }
                const paragraphs = text
                    .split(/\n\s*\n/)
                    .map((p) => sanitize(p))
                    .filter((p) => p.length >= 20);
                return paragraphs[0] || sanitize(text).slice(0, 280);
            };
            const extractStageBlock = (text: string, stageNumber: number) => {
                const labels: Record<number, string[]> = {
                    1: ['routine change', 'minor incidents'],
                    2: ['business impact'],
                    3: ['triage', 'context'],
                    4: ['resolution', 'post-incident review'],
                };
                const normalize = (line: string) =>
                    line
                        .toLowerCase()
                        .replace(/[`*_>#]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                const isStageHeader = (line: string, targetStage?: number) => {
                    const n = normalize(line);
                    const numbered = n.match(/^(?:[-*]\s*)?(?:stage\s*)?([1-4])(?:[\).:\-]|\s)/);
                    if (numbered) {
                        const stage = Number(numbered[1]);
                        if (targetStage && stage !== targetStage) return false;
                        const requiredTerms = labels[stage] || [];
                        return requiredTerms.length === 0 || requiredTerms.every((term) => n.includes(term));
                    }
                    if (!targetStage) {
                        return Object.entries(labels).some(([idx, terms]) => terms.every((term) => n.includes(term)));
                    }
                    return (labels[targetStage] || []).every((term) => n.includes(term));
                };

                const lines = text.split('\n');
                let collecting = false;
                const collected: string[] = [];

                for (const line of lines) {
                    if (isStageHeader(line)) {
                        if (collecting && !isStageHeader(line, stageNumber)) break;
                        if (isStageHeader(line, stageNumber)) {
                            collecting = true;
                            continue;
                        }
                    }
                    if (!collecting) continue;

                    const normalized = normalize(line);
                    if (
                        normalized.includes('pagerduty operations cloud value') ||
                        normalized.includes('where pagerduty')
                    ) {
                        break;
                    }
                    collected.push(line);
                }

                return collected
                    .join('\n')
                    .replace(/^\s+|\s+$/g, '')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
            };
            if (!goldenDemoOutput.configJson) {
                goldenDemoOutput.configJson = {};
            }
            const tldr = extractTldr(fullNarrativeSource);
            if (tldr) {
                goldenDemoOutput.narrative = tldr;
            }
            goldenDemoOutput.configJson.narrative = {
                ...(goldenDemoOutput.configJson.narrative || {}),
                full: fullNarrativeSource,
                stages: {
                    ...(goldenDemoOutput.configJson.narrative?.stages || {}),
                    routine_change_minor: { text: extractStageBlock(fullNarrativeSource, 1) },
                    business_impact: { text: extractStageBlock(fullNarrativeSource, 2) },
                    triage_context: { text: extractStageBlock(fullNarrativeSource, 3) },
                    resolution_pir: { text: extractStageBlock(fullNarrativeSource, 4) },
                },
            };
        }

        if (!goldenDemoOutput.configJson) {
            goldenDemoOutput.configJson = {};
        }
        const summary = summarizeGeneratedItems(Array.isArray(items) ? items : []);
        goldenDemoOutput.configJson.generationDiagnostics = {
            provider,
            model: modelName,
            promptVersion,
            generatedAt: new Date().toISOString(),
            ...summary,
        };

        goldenDemoOutput.createdByUserId = state.createdByUserId;
        return { goldenDemoMetadata: goldenDemoOutput }; 
    } catch (error: any) {
        console.error("Builder Node Failed:", error);
        throw new Error(`Builder failed (${provider}): ${error.message}`);
    }
  }

  // --- Public Methods (Workflows) ---

  public async generateProposal(params: {
      prompt: string; 
      provider?: 'google' | 'openai';
      services?: any[];
      industry?: string;
      useCase?: string;
  }): Promise<string> {
    const graph = new StateGraph(AgentStateAnnotation)
      .addNode("planner", this.plannerNode.bind(this))
      .addEdge(START, "planner")
      .addEdge("planner", END);

    const app = graph.compile();
    
    const result = await app.invoke({
        userRequest: params.prompt, 
        provider: params.provider || 'openai',
        availableServices: params.services,
        goldenDemoIndustry: params.industry,
        goldenDemoUseCase: params.useCase
    });
    
    if (!result.planSummary) throw new Error("No plan generated");
    return result.planSummary as string;
  }

  public async buildCampaign(params: {
      prompt: string; 
      approvedPlan?: string; 
      provider?: 'google' | 'openai';
      services?: any[];
      eventCount?: number;
      changeCount?: number;
      goldenDemoName: string;
      industry: string;
      useCase: string;
      narrative: string;
      personaNotes?: string;
      createdByUserId: string;
      role: Role;
  }): Promise<GoldenDemo> { 
    
    const plan = params.approvedPlan || "Proceed with standard best practices for this scenario.";

    const graph = new StateGraph(AgentStateAnnotation)
      .addNode("builder", this.builderNode.bind(this))
      .addEdge(START, "builder")
      .addEdge("builder", END);

    const app = graph.compile();

    const result = await app.invoke({
        userRequest: params.prompt, 
        planSummary: plan, 
        provider: params.provider || 'openai',
        availableServices: params.services || [],
        eventCount: params.eventCount,
        changeCount: params.changeCount,
        goldenDemoName: params.goldenDemoName,
        goldenDemoIndustry: params.industry,
        goldenDemoUseCase: params.useCase,
        goldenDemoNarrative: params.narrative,
        goldenDemoPersonaNotes: params.personaNotes,
        createdByUserId: params.createdByUserId,
    });
    
    if (!result.goldenDemoMetadata) throw new Error("No Golden Demo metadata generated");

    const createdGoldenDemo = await this.goldenDemoService.createGoldenDemo({
      name: result.goldenDemoMetadata.name!,
      vertical: (result.goldenDemoMetadata as any).vertical || (result.goldenDemoMetadata as any).industry || params.industry || 'Legacy',
      maturityLevel: (result.goldenDemoMetadata as any).maturityLevel || 'Deprecated',
      industry: (result.goldenDemoMetadata as any).industry || params.industry,
      useCase: (result.goldenDemoMetadata as any).useCase || params.useCase,
      narrative: result.goldenDemoMetadata.narrative!,
      configJson: result.goldenDemoMetadata.configJson || {},
      personaNotes: result.goldenDemoMetadata.personaNotes,
      createdByUserId: result.goldenDemoMetadata.createdByUserId!,
    }, params.role);

    return createdGoldenDemo;
  }
}
