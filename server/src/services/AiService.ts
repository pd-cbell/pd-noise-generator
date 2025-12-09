import { GoogleGenerativeAI } from "@google/generative-ai";

// Fast model for simple tasks (Director Mode, basic randomizer)
const GEN_AI_MODEL = "gemini-2.5-flash";

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
   * Legacy method - retained for 'Director Mode' simple prompts if needed, 
   * but AgentBuilder now uses AgentService (LangGraph).
   */
  public async proposeScenario(userPrompt: string): Promise<string> {
     // ... Implementation kept simple or redirected ...
     if (!this.model) return "AI Disabled";
     
     try {
         const result = await this.model.generateContent(`Summarize a chaos plan for: ${userPrompt}`);
         return result.response.text();
     } catch (e) {
         console.error("AiService fast generate failed", e);
         throw e;
     }
  }

  // ... other methods can remain as fallback or be deprecated ...
}

export const aiService = new AiService();
