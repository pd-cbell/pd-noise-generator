# Release Roadmap: v2.0 Agentic Edition

**Goal:** Transform the tool from a "Noise Generator" into a "Solution Consultant's Assistant."

## ✅ Completed Features

### 1. Agentic Campaign Builder
- **Natural Language Input:** "Simulate a Black Friday checkout failure."
- **AI Architect (LangGraph):** Uses a multi-step reasoning process (Plan -> Build) to ensure high-quality scenarios.
- **Golden Demo Narrative:** Enforces a standard 4-stage arc (Signal -> Impact -> Triage -> Resolution) focusing on PagerDuty value.
- **High-Control UI:** Edit the narrative, select specific services (Actors), and control event volume before generation.

### 2. Dual-Provider AI Core
- **Flexible Backend:** Supports both **Google Gemini** (2.5 Pro/Flash) and **OpenAI** (GPT-5.1/4o).
- **Structured Outputs:** Uses Zod schemas for OpenAI to guarantee valid JSON configuration.

### 3. "Demo Slice" Management
- **Visibility Toggles:** Hide/Show "NOC" and "SRE" admin teams in the UI to keep demos clean.
- **Decoupled Logic:** Load *all* data for the Agent to use, while restricting *Background Noise* to specific teams.

### 4. Database Enhancements
- **Service Metadata:** Added `changeIntegrationKey` and `type` fields to support richer scenarios.

## 🚧 Pending Polish (v2.1)

- **ChatOps Persona Engine:** Generate realistic Slack messages based on team tone (Anxious vs. Professional).
- **Director Mode Soundboard:** A visual grid for one-click injection of pre-built scenarios during live demos.
- **Multi-Region Support:** Explicit handling of EU/US PagerDuty endpoints.

## 📦 Deployment Instructions

1.  **Pull Changes:** `git checkout main && git pull`
2.  **Install Dependencies:**
    - Server: `cd server && npm install`
    - Client: `cd client && npm install`
3.  **Environment:**
    - Add `GEMINI_API_KEY` or `OPENAI_API_KEY` to `server/.env`.
4.  **Database:**
    - Run `cd server && npx prisma migrate deploy` to apply the new Service schema.
5.  **Build & Run:**
    - `npm run build` (both)
    - `npm start`
