# Roadmap v2.1: The Golden Demo Platform

**Goal:** Elevate the tool from an "Agentic Noise Generator" to a persistent "Golden Demo Platform." This release introduces a robust persistence layer for AI-generated scenarios, enabling Solution Consultants to build, save, share, and instantly launch curated demos with a guided presenter experience.

---

## Phase 1: Golden Demo Abstraction (Core Data Layer) - (Complete)
*Establishes the system of record for high-value demos.*

### 1.1 Data Model (Schema)
- **New Model: `GoldenDemo`**
  - `id`: UUID (PK)
  - `name`: String (Unique constraint per user or global?)
  - `vertical`: String (e.g., "Retail", "FSI", "Tech")
  - `maturityLevel`: String (e.g., "Reactive", "Proactive", "Preventative")
  - `narrative`: String (Markdown supported, describes the 4-stage arc)
  - `configJson`: JSONB (The full simulation configuration, **extended to include `beats` array**)
  - `personaNotes`: String (Context for the presenter)
  - `createdByUserId`: String (FK to User)
  - `createdAt`, `updatedAt`: DateTime
- **Migration:** Create migration SQL using Prisma.

### 1.2 Backend API (CRUD)
- **Service:** `GoldenDemoService` (Business logic layer).
- **Endpoints:**
  - `GET /api/golden-demos`: List all (supports filtering by `vertical` or `owner`).
  - `POST /api/golden-demos`: Create new. Validates JSON structure and string lengths.
  - `PUT /api/golden-demos/:id`: Update narrative, notes, or config.
  - `DELETE /api/golden-demos/:id`: Soft-delete or archive.
- **Agent Integration:**
  - Refactor `AgentService` to output a structure compatible with `GoldenDemo`.
  - Ensure Agent output includes `beats` (see Phase 4).

### 1.3 Frontend (Library & Management)
- **Library View:**
  - Left-hand sidebar list of available Golden Demos.
  - Filter/Search by Name or Vertical.
- **Detail Panel:**
  - View Narrative and Persona Notes.
  - "Launch Simulation" button (loads `configJson` into the engine).
  - Edit form for metadata (Name, Narrative, Notes).

---

## Phase 2: Director Mode (The Consumer) - (Complete)
*The "Soundboard" UI that utilizes the Golden Demo data layer.*

- **UI Implementation:**
  - A visual grid view of Golden Demos (superseding the basic list).
  - "One-Click" activation for live demos.
- **Integration:** 
  - Connects directly to `GoldenDemoService`.
  - Replaces the transient "Template Library" (localStorage) with this robust database-backed solution.

---

## Phase 3: Enhanced Realism (Polish) - (Complete)

### 3.1 ChatOps Persona Engine
- **Goal:** Generate realistic Slack messages based on team tone.
- **Implementation:**
  - Add `tone` field to Team configuration (e.g., "Anxious", "Professional", "Casual").
  - Use `Faker.js` or a lightweight LLM call to generate chatter that matches the tone during incidents.

### 3.2 Multi-Region Support
- **Goal:** Explicit handling of EU/US PagerDuty endpoints.
- **Implementation:**
  - Add `pdRegion` to User/Configuration.
  - Update `PagerDutyClient` to switch base URLs (`api.pagerduty.com` vs `api.eu.pagerduty.com`) based on selection.

---

## Phase 4: Narrative & Session UX - (Complete)
*The "Presenter View" for guided, consistent demos.*

### 4.1 Data Model (Session & Beats)
- **New Model: `Session`**
  - `id`: UUID (PK)
  - `goldenDemoId`: UUID (FK)
  - `name`: String (optional, e.g., "Demo for Acme Corp")
  - `startedAt`: DateTime
  - `endedAt`: DateTime (nullable)
  - `metricsSnapshotJson`: JSONB (Stores MTTA, MTTR, Incident Counts at session end)
  - `notes`: String (User notes for this specific run)
  - `createdByUserId`: String (FK to User)
- **GoldenDemo Config Update:**
  - Extend `configJson` to include `beats`:
    ```typescript
    beats: Array<{
      id: string;
      title: string;
      description: string;
      whatToShowInPagerDuty: string;
      whatToSay: string;
      approxTimingSec?: number;
    }>
    ```

### 4.2 Backend API (Sessions)
- **Service:** `SessionService`.
- **Endpoints:**
  - `POST /api/sessions/start`: Creates a `Session` linked to a `GoldenDemo`. Resets/Starts simulation.
  - `POST /api/sessions/:id/end`: Marks `endedAt`, captures `metricsSnapshot` from `ServerSimulationEngine`.
  - `GET /api/sessions`: List history (filter by user/demo).
- **Metric Snapshot Helper:**
  - Implement a utility to extract a lightweight JSON summary from the live simulation state.

### 4.3 Frontend (Presenter View)
- **Presenter View UI:**
  - Displays the `beats` list in order.
  - "Next Beat" / "Complete" controls.
  - Shows `whatToShowInPagerDuty` and `whatToSay` prompts.
  - Displays real-time session timer and key metrics (MTTA/MTTR).
- **Session History UI:**
  - Read-only list of past sessions.
  - Detail view showing the metrics snapshot and notes.

### 4.4 Agent Enhancements
- Update `AgentService` prompts and Zod schema.
- **Goal:** AI must generate 3-5 narrative beats for every campaign, with specific "Talk Track" and "Demo Path" guidance.

---

## Phase 5: Seeding & Validation - (Complete)

### 5.1 Default Demos
- Create a seed script (`prisma/seed_demos.ts`) to populate the database with best-practice examples (including Beats):
  - "OrbitPay – Instant Transfer Latency Spiral"
  - "Retail – Black Friday Checkout Failure"

### 5.2 Validation Guardrails
- Ensure `configJson` is valid and includes `beats`.
- Enforce character limits.
- Validates that `metricsSnapshot` is captured correctly on session end.