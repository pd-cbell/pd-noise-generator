# Agent Notes - v1.7 Replatform (Complete)

**Branch:** `gemini-replatform`

## Status: Core Logic Replatformed & Validated

### Completed Features
- **Phase 1.1: Authentication (Google OAuth)**
    - `User` model with Google ID.
    - `/auth/google` backend flow with JWT sessions.
    - Frontend `AuthContext` and `Login` screen.
    - **Dev Login Bypass** for local testing.
- **Phase 1.2: Multi-User Data Scoping**
    - Profiles and Campaigns are scoped to `userId`.
    - `authenticateUser` middleware secures API routes.
- **Phase 1.3: Secure User Credentials Storage**
    - AES-256 encryption for API Token, Routing Key, From Email.
    - Stored in DB per user, decrypted only for simulation execution.
- **Phase 2.1: Server-Side Simulation Engine**
    - `ServerSimulationEngine` runs headless loops on the backend.
    - `SimulationInstance` manages per-user state.
    - Logic ported from frontend: Poisson generation, API calls (direct to PD), lifecycle management (Auto-Ack/Resolve).
- **Phase 2.2: Real-time Communication (WebSockets)**
    - `Socket.io` integration with JWT auth.
    - `SimulationProvider` (Context) manages single socket connection.
    - `MonitorDashboard` consumes real-time `sim_tick` updates.
- **Phase 3: Cloud Deployment**
    - `deploy/aws-cfn.yaml` updated to support optional RDS PostgreSQL.

### Key Architectural Changes
- **Client/Server Split:** The Frontend is now purely a UI/Remote Control. All logic runs on the Node.js backend.
- **Persistence:** Active simulations survive page reloads because state is held in backend memory (`SimulationManager`).
- **Single Source of Truth:** `SimulationContext` ensures all components (Header, Dashboard) reflect the exact server state via WebSockets.

## Configuration & Credentials
- **Frontend:** `VITE_GOOGLE_CLIENT_ID` (or use Dev Login).
- **Backend:**
    - `JWT_SECRET`: For session cookies.
    - `ENCRYPTION_KEY`: 32-char key for credential encryption.
    - `GOOGLE_CLIENT_ID`: For token verification.
    - `DATABASE_URL`: Postgres connection.

## Known Behaviors
- **Headless Mode:** If you close the browser, the simulation continues running on the server.
- **Reconnection:** Opening the app logs you in (via cookie) and immediately reconnects to the running simulation stream.

## Local Testing
1.  `docker-compose up -d db`
2.  `cd server && npm run dev`
3.  `cd client && npm run dev`
4.  Use "Dev Login" to bypass Google.
