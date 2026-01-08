# PagerDuty Golden Demo Platform v2.4

![Golden Demo Platform](customer_sim.png)

A persistent **Golden Demo Platform** for designing, managing, and delivering consistent, high-impact PagerDuty demonstrations.

![Version](https://img.shields.io/badge/version-2.4-blue) ![Docker](https://img.shields.io/badge/docker-ready-green) ![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20GPT-orange)

Status: v2.4 in progress (cloud validation pending).

## 🚀 New in v2.4

v2.4 focuses on presenter-ready run monitoring, narrative guidance, and editor domain configuration.

-   **Track Run Monitor:** Track run lifecycle panel with incident timelines and status.
-   **Presenter Guide:** Narrative stage prompts plus beat-by-beat script cues.
-   **Editor Domain Config:** Editors can load domain config for services, mapping profiles, and agent context.
-   **Golden Demo Export/Import:** Export demos to JSON and re-import them.
-   **Admin Impersonation:** Admins can impersonate users for debugging and setup.

## 🧠 Core Concepts: Hybrid Architecture

The platform employs a powerful **Hybrid Architecture**:

-   **Design Time (AI-Powered):** The `AgentService` (LangGraph + Gemini/GPT) acts as an intelligent architect, designing complex JSON scenarios and narratives based on your natural language prompt and PagerDuty environment.
-   **Run Time (Local Faker.js):** The `FakerService` executes these designs locally at high speed, ensuring tactical reliability and realism without LLM latency during live demos.

## ✨ Core Features
-   **Golden Demo Library:** Create, edit, and manage a library of perfect demos.
-   **Director Mode:** A visual "Soundboard" for launching Golden Demos.
-   **Agentic Builder:** AI-driven creation of Golden Demos with specific volume, service, and narrative constraints.
-   **Poisson Noise Generation:** Simulates realistic background traffic.
-   **Lifecycle Automation:** Auto-Acknowledge/Resolve based on severity targets.

## 🛠️ Local Development

### Environment configuration
1) Copy examples:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```
2) Fill required values in `server/.env`:
   - `DATABASE_URL` (PostgreSQL)
   - `JWT_SECRET`, `ENCRYPTION_KEY`
   - `CLIENT_URL` (default `http://localhost:5173`)
   - `GOOGLE_CLIENT_ID` (Google OAuth)
   - `PD_REST_API_TOKEN`, `PD_FROM_EMAIL`, `PD_EVENTS_ROUTING_KEY`
   - `GEMINI_API_KEY` or `OPENAI_API_KEY` (Required for Agent features)
3) Fill `client/.env`:
   - `VITE_API_URL` (default `http://localhost:3001`)
   - `VITE_GOOGLE_CLIENT_ID` (Google OAuth)

### Quick Start
1. **Start Database:** `docker-compose up -d db`
2. **Backend:** `cd server && npm install && npx prisma migrate dev && npm run dev`
3. **Frontend:** `cd client && npm install && npm run dev`
4. **Access:** `http://localhost:5173`

## ☁️ Deployment (AWS)
Includes CloudFormation template (`deploy/aws-cfn.yaml`) for EC2 deployment.

## 📚 Legacy Docs
Historical docs are kept in `docs/ARCHIVE`.
Recent changelog: `docs/CHANGELOG_v2.3.md`.

## 📜 License
Provided as-is for demonstration purposes.
