# Agent Notes - v2.1 Golden Demo Platform

**Branch:** `2.1`

## Status: v2.1 Development

### Architecture Evolution: Golden Demo Platform
v2.1 builds upon the "Hybrid" architecture by introducing a robust persistence layer.
- **Design Time (AI):** `AgentService` now generates and persists reusable `GoldenDemo` objects, not just transient configurations.
- **Run Time (Faker):** The simulation engine loads these persisted `GoldenDemo` configs for consistent execution.

### Key Components

#### 1. Agent Service (`server/src/services/AgentService.ts`)
- **Framework:** `LangGraph` state machine.
- **Nodes:**
    - `plannerNode`: Generates a 4-stage "Golden Demo" narrative.
    - `builderNode`: Generates a complete `GoldenDemo` object (Config + Metadata + Narrative).
- **Persistence:** Injected `GoldenDemoService` automatically saves successful builds to the database.
- **Providers:** Dual-support for **Gemini** (default: `gemini-2.5-pro`) and **OpenAI** (default: `gpt-5.1` / `gpt-4o`).

#### 2. Golden Demo Service (`server/src/services/GoldenDemoService.ts`)
- **Responsibility:** Manages the lifecycle of `GoldenDemo` records.
- **Data Model:** Stores full simulation configuration, narrative beats, and presenter notes.

#### 3. Service Selector (`client/src/components/ServiceSelector.tsx`)
- Hierarchical UI component grouping services by Team.
- **Search:** Filters services/teams by name.
- **Demo Slice Filter:** Toggles visibility of "NOC" and "SRE" admin teams to reduce noise.

### Technical Debt / Gotchas
- **Database:** Ensure migration `20251210215025_add_golden_demo_model` is applied.
- **Env Vars:** Requires `GEMINI_API_KEY` or `OPENAI_API_KEY` in `server/.env`.
- **Model Availability:** `gemini-1.5-pro` is deprecated/unavailable in some regions; we use `gemini-2.5-pro`.

### Next Steps
- **Frontend Library:** Build the UI to browse and launch Golden Demos.
- **Director Mode:** Implement the "Soundboard" for live demos.
- **Session UX:** Add "Presenter View" with narrative beats and timing.