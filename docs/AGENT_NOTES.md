# Agent Notes - v1.7 Replatform

**Branch:** `gemini-replatform`

## Status: Phase 1 Complete, Phase 2 Started

### Completed
- **Phase 1.1: Authentication**
    - Added `User` model (Prisma).
    - Implemented Google OAuth flow (Backend verify, Frontend provider).
    - Added `AuthContext` and `Login` component.
- **Phase 1.2: Scoping**
    - Added `authenticateUser` middleware.
    - Scoped `profiles` and `campaigns` endpoints to logged-in user.
- **Phase 1.3: Secure Credentials**
    - Implemented AES-256 encryption (`utils/crypto.ts`).
    - Added `PUT /auth/credentials` to save PagerDuty keys.
    - Updated `ConfigurationForm` to allow saving/loading creds.

### In Progress (Phase 2: Server-Side Engine)
- **Backend Logic:**
    - Created `ServerSimulationEngine.ts` (Skeleton).
    - Created `SimulationInstance` class to run per-user loops.
- **WebSockets:**
    - Integrated `Socket.io` on backend with auth middleware (cookie parsing).
    - Server listens for `start_simulation`/`stop_simulation` and emits `sim_tick` (mock data).

### Next Steps
1.  **Frontend Socket Integration:** Update `MonitorDashboard` to consume data from `socket.io-client` instead of local state.
2.  **Port Logic:** Move the full `SimulationEngine.ts` logic (from client) into `ServerSimulationEngine.ts` (server), ensuring it uses the decrypted credentials.
3.  **Cloud Persistence:** Update CloudFormation for RDS (Phase 3).

## Credentials
- **JWT Secret:** Currently using fallback 'dev-secret-key-change-me'. Needs env var in prod.
- **Encryption Key:** Currently using fallback '1234...'. Needs env var in prod.
- **Google Client ID:** Frontend using placeholder. Needs real ID in `.env`.

## Testing
- Run `docker-compose up` to spin up DB.
- `cd server && npm run dev`
- `cd client && npm run dev`
- Login with Google (mocked or real if configured).
- Save credentials to profile.
