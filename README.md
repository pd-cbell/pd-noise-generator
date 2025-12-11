# PagerDuty Golden Demo Platform v2.1

![Golden Demo Platform](customer_sim.png)

A persistent **Golden Demo Platform** for designing, managing, and delivering consistent, high-impact PagerDuty demonstrations.

![Version](https://img.shields.io/badge/version-2.1.0-blue) ![Docker](https://img.shields.io/badge/docker-ready-green) ![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20GPT-orange)

## 🚀 New in v2.1: The Golden Demo Platform

v2.1 elevates the tool from a noise generator to a strategic demo asset manager.

-   **Persistent "Golden Demos":** Save AI-generated campaigns as reusable, persistent assets in the database.
-   **Agentic Architect (Enhanced):**
    -   **Context-Aware Planning:** The AI Planner now understands Verticals (e.g., Retail, FinServ), Maturity Levels (Reactive, Proactive), and *your actual PagerDuty services* to craft tailored narratives.
    -   **4-Stage Narrative Arc:** Enforces a strict best-practice structure: Routine Change -> Business Impact -> Triage -> Resolution.
-   **Director Mode (Soundboard):** A visual grid for "one-click" activation of your saved Golden Demos.
-   **Presenter View:** A guided, real-time dashboard for presenters, featuring:
    -   **Narrative Beats:** Step-by-step cues on what to say and what to show.
    -   **Live Metrics:** Real-time MTTA/MTTR tracking during the session.
    -   **Session History:** Track every run of a demo for compliance and review.
-   **Enhanced Realism:**
    -   **ChatOps Persona Engine:** Slack messages now match specific team tones (e.g., "Anxious", "Professional").
    -   **Multi-Region Support:** Native support for both US and EU PagerDuty regions.

## 🧠 Core Concepts: Hybrid Architecture

The platform employs a powerful **Hybrid Architecture**:

-   **Design Time (AI-Powered):** The `AgentService` (LangGraph + Gemini/GPT) acts as an intelligent architect, designing complex JSON scenarios and narratives based on your natural language prompt and PagerDuty environment.
-   **Run Time (Local Faker.js):** The `FakerService` executes these designs locally at high speed (100+ RPM), ensuring tactical reliability and realism without LLM latency during live demos.

## ✨ Core Features
-   **Golden Demo Library:** Create, edit, and manage a library of perfect demos.
-   **Agentic Builder:** AI-driven creation of campaigns with specific volume, service, and narrative constraints.
-   **Poisson Noise Generation:** Simulates realistic background traffic.
-   **Lifecycle Automation:** Auto-Acknowledge/Resolve based on severity targets.
-   **Zero-Config Webhooks:** Trigger campaigns from CI/CD pipelines.

## 🛠️ Local Development

### Environment configuration
1) Copy examples:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```
2) Fill required values in `server/.env`:
   - `DATABASE_URL` (PostgreSQL)
   - `PD_REST_API_TOKEN`, `PD_FROM_EMAIL`, `PD_EVENTS_ROUTING_KEY`
   - `GEMINI_API_KEY` or `OPENAI_API_KEY` (Required for Agent features)
3) Fill `client/.env`:
   - `VITE_API_URL` (default `http://localhost:3001`)

### Quick Start
1. **Start Database:** `docker-compose up -d db`
2. **Backend:** `cd server && npm install && npx prisma migrate dev && npm run dev`
3. **Frontend:** `cd client && npm install && npm run dev`
4. **Access:** `http://localhost:5173`

## ☁️ Deployment (AWS)
Includes CloudFormation template (`deploy/aws-cfn.yaml`) for EC2 deployment.

## 📜 License
Provided as-is for demonstration purposes.