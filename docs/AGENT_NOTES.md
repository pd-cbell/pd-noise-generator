# Agent Notes - v2.1 Golden Demo Platform

**Branch:** `2.1`

## Status: v2.1 Release Candidate (Complete)

### Architecture Evolution: Golden Demo Platform
v2.1 transforms the tool into a persistent "Golden Demo Platform".
- **Design Time (AI):** `AgentService` generates and persists reusable `GoldenDemo` objects (Config + Narrative + Beats).
- **Run Time (Faker):** The simulation engine loads these persisted `GoldenDemo` configs for consistent execution via `Session` tracking.

### Key Components (Completed)

#### 1. Agent Service (`server/src/services/AgentService.ts`)
- **Framework:** `LangGraph` state machine (Planner -> Builder).
- **Output:** Generates full `GoldenDemo` objects with `beats` (script cues).
- **Persistence:** Automatically saves to Postgres via `GoldenDemoService`.
- **Providers:** Dual-support for **Gemini 2.5 Pro** and **GPT-5.1**.

#### 2. Golden Demo Service (`server/src/services/GoldenDemoService.ts`)
- **Data Model:** `GoldenDemo` (Configuration, Narrative) and `Session` (Run history).
- **API:** Full CRUD endpoints for Demos and Sessions.

#### 3. Director Mode (`client/src/components/DirectorDashboard.tsx`)
- **UI:** Visual "Soundboard" grid of available Golden Demos.
- **Action:** One-click launch that creates a `Session` and starts the simulation.

#### 4. Presenter View (`client/src/components/PresenterDashboard.tsx`)
- **UI:** Timeline of "Narrative Beats" (Say/Show cues).
- **Metrics:** Live view of MTTA/MTTR and active incident counts.
- **Controls:** End Session button capturing final snapshots.

#### 5. Enhanced Realism
- **ChatOps:** `ServerSimulationEngine` generates persona-driven Slack messages ("Anxious", "Professional").
- **Multi-Region:** Support for `api.pagerduty.com` (US) and `api.eu.pagerduty.com` (EU).

### Current Focus: Testing & Troubleshooting

#### 1. Agent Generation
- **Test:** Verify `AgentBuilder` generates valid JSON for `configJson` and `beats`.
- **Verify:** Check that `createdByUserId` is correctly populated from the authenticated user.

#### 2. Simulation Execution
- **Test:** Launch a Golden Demo from "Director Mode".
- **Verify:**
    - Incidents trigger in PagerDuty.
    - Slack messages appear with correct persona tone (if configured).
    - "Presenter View" timer runs and metrics update.

#### 3. Data Persistence
- **Test:** End a session.
- **Verify:** `Session` record is updated with `endedAt` and `metricsSnapshotJson`. Check "Session History" in the Golden Demo Detail view.

#### 4. Multi-Region
- **Test:** Switch region to EU in `ConfigurationForm`.
- **Verify:** `PagerDutyClient` targets `api.eu.pagerduty.com`.

### Technical Debt / Gotchas
- **Database:** Ensure migration `20251210223440_add_session_model` is applied.
- **Env Vars:** Requires `GEMINI_API_KEY` or `OPENAI_API_KEY`.
- **Store:** `useStore.ts` structure is sensitive; ensure `addLog` remains accessible to all slices.
