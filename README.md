# PagerDuty Incident Noise Simulator v2.0 (Agentic Edition)

A full-stack, multi-user application for generating realistic incident noise against PagerDuty. Now featuring an **AI-Powered Agentic Architect** for designing complex failure scenarios ("Golden Demos").

![Version](https://img.shields.io/badge/version-2.0.0-purple) ![Docker](https://img.shields.io/badge/docker-ready-green) ![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20GPT-orange)

## 🚀 New in v2.0 (Agentic Edition)
- **Agentic Campaign Builder:** Describe a scenario (e.g., "Checkout DB failure during Black Friday") and the AI Agent designs a complete 4-stage "Golden Demo" campaign.
- **Dual-Provider AI:** Choose between **Gemini 2.5 Pro** and **GPT-5.1** (OpenAI) for generation.
- **LangGraph Architecture:** Uses a "Planner -> Builder" workflow to ensure scenarios follow best-practice PagerDuty narratives (Signal -> Impact -> Triage -> Resolution).
- **Structured Outputs:** Guarantees valid JSON configuration for all AI-generated content.
- **Director Mode:** Trigger predefined templates instantly for live demos.

## ✨ Core Features
- **Poisson Noise Generation:** Simulates realistic, non-deterministic incident traffic.
- **Lifecycle Automation:** Auto-Acknowledge and Auto-Resolve incidents based on severity targets.
- **Campaign Engine:** Design complex failure scenarios (Alerts + Change Events) with a visual editor.
- **Zero-Config Webhooks:** Trigger campaigns from CI/CD pipelines using secure, token-less magic links.
- **Event Bursts:** Simulate "Event Storms" with compressed alert bursts.

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)
- **AI Keys:** `GEMINI_API_KEY` (Google) and/or `OPENAI_API_KEY` (OpenAI) in `server/.env`.

### Quick Start
1.  **Start Database:**
    ```bash
    docker-compose up -d db
    ```
2.  **Backend:**
    ```bash
    cd server
    npm install
    npx prisma migrate dev
    npm run dev
    ```
3.  **Frontend:**
    ```bash
    cd client
    npm install
    npm run dev
    ```
4.  **Access:** Open `http://localhost:5173`. Use **"Dev Login (Bypass)"** to start without Google credentials.

## ☁️ Deployment (AWS)

This repository includes a CloudFormation template (`deploy/aws-cfn.yaml`) that deploys the entire stack to an EC2 instance.

- **EC2:** hosting Docker containers (Frontend + Backend).
- **RDS (Optional):** Managed PostgreSQL database for persistence.
- **Security:** Auto-configures Security Groups for HTTP/SSH access.

**Required Parameters:**
- `JwtSecret`: A secure random string.
- `EncryptionKey`: A 32-character secure random string.
- `GoogleClientId`: Your Google OAuth Client ID (configure Authorized Origins for the EC2 public IP).

## 🔐 Environment Variables

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Secret key for signing session cookies. |
| `ENCRYPTION_KEY` | 32-char key for encrypting user API tokens. |
| `GOOGLE_CLIENT_ID` | OAuth Client ID for Google Sign-In. |
| `GEMINI_API_KEY` | (Optional) API key for Google Gemini AI. |
| `OPENAI_API_KEY` | (Optional) API key for OpenAI (GPT-4o/5.1). |
| `CLIENT_URL` | URL of the frontend (for CORS). |

## 📜 License
This project is provided as-is for demonstration purposes.
