# Agent Notes - v2.0 Agentic Edition

**Branch:** `feature/v2.0-agentic-polish`

## Status: v2.0 Release Candidate

### Architecture Pivot: "Hybrid" Design
v2.0 shifts from a pure manual configuration tool to an **AI-Assisted** platform.
- **Design Time (AI):** Uses `LangGraph` (Gemini/GPT) to construct complex JSON campaigns from natural language.
- **Run Time (Faker):** Uses local `FakerService` to execute campaigns at high speed (100+ RPM) without LLM latency.

### Key Components

#### 1. Agent Service (`server/src/services/AgentService.ts`)
- **Framework:** `LangGraph` state machine.
- **Nodes:**
    - `plannerNode`: Generates a 4-stage "Golden Demo" narrative (Signal -> Impact -> Triage -> Resolution).
    - `builderNode`: Generates structured JSON matching the plan.
- **Providers:** Dual-support for **Gemini** (default: `gemini-2.5-pro` + `gemini-2.5-flash`) and **OpenAI** (default: `gpt-5.1` / `gpt-4o`).
- **Structured Outputs:** Uses Zod schemas when running on OpenAI to strictly enforce valid campaign JSON.

#### 2. Service Selector (`client/src/components/ServiceSelector.tsx`)
- Hierarchical UI component grouping services by Team.
- **Search:** Filters services/teams by name.
- **Demo Slice Filter:** Toggles visibility of "NOC" and "SRE" admin teams to reduce noise.

#### 3. Data Decoupling
- **Loading:** `fetchServices` now loads *all* services for available teams.
- **Simulation:** `ConfigurationForm` selection *only* controls "Background Noise".
- **Agent:** Can select *any* loaded service as an actor for a campaign.

### Technical Debt / Gotchas
- **Database:** Ensure migration `20251209172620_add_service_metadata` is applied.
- **Env Vars:** Requires `GEMINI_API_KEY` or `OPENAI_API_KEY` in `server/.env`.
- **Model Availability:** `gemini-1.5-pro` is deprecated/unavailable in some regions; we use `gemini-2.5-pro`.

### Next Steps
- **Persona ChatOps:** Implement the Logic to generate Slack-style chatter based on Team Persona.
- **Director Mode:** Polish the real-time "Soundboard" for live demos.