# PagerDuty Golden Demo Platform v2.3.1

![Golden Demo Platform](customer_sim.png)

A persistent **Golden Demo Platform** for designing, managing, and delivering consistent, high-impact PagerDuty demonstrations.

![Version](https://img.shields.io/badge/version-2.3.1-blue) ![Docker](https://img.shields.io/badge/docker-ready-green) ![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20GPT-orange)

## 🚀 New in v2.3.1

v2.3.1 stabilizes the Golden Demo Platform workflow and completes the v2.2.x feature set for real-world demo reuse.

-   **Service Mapping Profiles:** Map logical demo service names to real PagerDuty services and routing keys (incident + change), including optional per-service Change routing key overrides.
-   **Golden Demo Editor:** Edit demo metadata, narrative stages, and the scripted event list (`configJson.items`) with required `logicalServiceName`.
-   **Imports:** Import legacy Campaign Failure JSON and Crux `event_group` JSON into Golden Demos (paste/file upload + base offset adjustment).
-   **Triggers:** Start a Golden Demo server-side via `POST /api/golden-demos/:id/trigger` (routing keys + optional mapping profile override).

## 🧠 Core Concepts: Hybrid Architecture

The platform employs a powerful **Hybrid Architecture**:

-   **Design Time (AI-Powered):** The `AgentService` (LangGraph + Gemini/GPT) acts as an intelligent architect, designing complex JSON scenarios and narratives based on your natural language prompt and PagerDuty environment.
-   **Run Time (Local Faker.js):** The `FakerService` executes these designs locally at high speed, ensuring tactical reliability and realism without LLM latency during live demos.

## ✨ Core Features
-   **Golden Demo Library:** Create, edit, and manage a library of perfect demos.
-   **Director Mode:** A visual "Soundboard" for launching Golden Demos.
-   **Agentic Builder:** AI-driven creation of campaigns with specific volume, service, and narrative constraints.
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
