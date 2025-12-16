# PagerDuty Golden Demo Platform v2.2

![Golden Demo Platform](customer_sim.png)

A persistent **Golden Demo Platform** for designing, managing, and delivering consistent, high-impact PagerDuty demonstrations.

![Version](https://img.shields.io/badge/version-2.3.1-blue) ![Docker](https://img.shields.io/badge/docker-ready-green) ![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20GPT-orange)

## 🚀 New in v2.3: Multi-Sim & Director Control

v2.3 introduces a powerful multi-track simulation architecture.

-   **Multi-Simulation Architecture:** Run "Background Noise" and multiple "Golden Demos" concurrently as independent tracks.
-   **Enhanced Director Mode:**
    -   **Active Tracks Panel:** Monitor running Golden Demos in real-time with a slide-out status panel.
    -   **Concurrent Injection:** Launch demos without stopping the background simulation.
-   **Frictionless Mapping:** "Add to Profile" feature in Configuration allows rapid bulk creation of service mappings.
-   **Cleanup:** Deprecated "Campaigns" feature removed in favor of the unified Golden Demo platform.

## 🧠 Core Concepts: Hybrid Architecture

The platform employs a powerful **Hybrid Architecture**:

-   **Design Time (AI-Powered):** The `AgentService` (LangGraph + Gemini/GPT) acts as an intelligent architect, designing complex JSON scenarios and narratives based on your natural language prompt and PagerDuty environment.
-   **Run Time (Local Faker.js):** The `FakerService` executes these designs locally at high speed, ensuring tactical reliability and realism without LLM latency during live demos.

## ✨ Core Features
-   **Golden Demo Library:** Create, edit, and manage a library of perfect demos.
-   **Director Mode:** A visual "Soundboard" for one-click injection of scenarios into a running simulation.
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
