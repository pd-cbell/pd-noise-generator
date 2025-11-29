# PagerDuty Incident Noise Simulator v1.7.2

A full-stack, multi-user application for generating realistic incident noise against PagerDuty. Now with **Server-Side Execution**, **User Authentication**, and **Persistent Sessions**.

![Version](https://img.shields.io/badge/version-1.7.2-blue) ![Docker](https://img.shields.io/badge/docker-ready-green)

## 🚀 New in v1.7 (Replatform)
- **Headless Simulation:** The simulation engine runs on the backend. You can close your browser, and noise will continue to generate.
- **Multi-User Support:** Sign in with Google (or Dev Login). Each user has their own isolated Profiles, Campaigns, and Active Simulations.
- **Real-Time Dashboard:** Powered by WebSockets (Socket.io) for instant updates on incidents, API usage, and MTTA/MTTR metrics.
- **Secure Credentials:** PagerDuty API tokens are encrypted at rest (AES-256) and linked to your user profile. No more copy-pasting tokens every session.
- **Cloud Database:** Ready for AWS RDS deployment via CloudFormation.

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

## 🔐 Environment Variables

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Secret key for signing session cookies. |
| `ENCRYPTION_KEY` | 32-char key for encrypting user API tokens. |
| `GOOGLE_CLIENT_ID` | OAuth Client ID for Google Sign-In. |
| `CLIENT_URL` | URL of the frontend (for CORS). |

## 📜 License
This project is provided as-is for demonstration purposes.
