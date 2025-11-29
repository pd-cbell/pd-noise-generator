# Agent Notes - v1.7 Replatform

**Branch:** `gemini-replatform`

## Status: v1.7.1 Complete - Ready for Testing/Merge

### Completed Features
- **Phase 1.1: Authentication (Google OAuth)**
    - `User` model with Google ID.
    - `/auth/google` backend flow with JWT sessions.
    - Frontend `AuthContext` and `Login` component.
    - **Development Login Bypass** (`POST /auth/dev-login`) for easy local testing.
- **Phase 1.2: Multi-User Data Scoping**
    - `Profile` and `Campaign` models scoped to `userId`.
    - `authenticateUser` middleware secures API routes.
- **Phase 1.3: Secure User Credentials Storage**
    - AES-256 encryption (`server/src/utils/crypto.ts`) for PagerDuty API Token, Global Routing Key, From Email.
    - `PUT /auth/credentials` endpoint.
    - `ConfigurationForm` updated to allow saving/loading credentials from user profile.
- **Phase 2.1: Server-Side Simulation Engine (Headless)**
    - `ServerSimulationEngine.ts` fully implemented (Poisson generation, incident lifecycle, metrics).
    - `PagerDutyClient.ts` handles backend PagerDuty API interactions.
- **Phase 2.2: Real-time Communication (WebSockets)**
    - `Socket.io` integrated on backend with JWT auth.
    - `SimulationProvider` (Context) and `useServerSimulation` hook created for robust client-server state sync.
    - `App.tsx`, `Header.tsx`, `MonitorDashboard.tsx` updated to use server-driven simulation state.
- **Phase 3: Cloud Deployment Enhancements**
    - `deploy/aws-cfn.yaml` updated to support optional RDS PostgreSQL.
- **v1.7.1 Enhancements:**
    - **API Stability & Performance (Batched Ops & Rate Limiting):**
        - `PagerDutyClient.ts`: Implemented `throttle()` for simple rate limiting (200ms interval, 429 retry).
        - `PagerDutyClient.ts`: Added `manageIncidentsBatch()` for bulk Acknowledge/Resolve.
        - `ServerSimulationEngine.ts`: Refactored `ackIncident`/`resolveIncident` to queue actions and `tick()` to process these queues using `manageIncidentsBatch`.
    - **Dynamic Payloads (Faker.js):**
        - `@faker-js/faker` installed on backend.
        - `server/src/utils/TemplateParser.ts` created to parse `{{faker...}}` and Crux-style macros.
        - `ServerSimulationEngine.ts` and `CampaignExecutor.ts` updated to apply `TemplateParser` to incident payloads.
    - **Server-Side Import (Crux Campaigns):**
        - `POST /api/campaigns/import` endpoint added to backend.
        - `api.ts` and `CampaignManager.tsx` updated to use this new endpoint for importing Crux JSON files.
    - **Fixes:**
        - Fixed `DEFAULT_CAMPAIGN_CONFIG` export.
        - Fixed `MonitorDashboard` data consumption after context refactor.
        - Fixed `useServerSimulation` loading state.

### Next Steps
- User Testing of `v1.7.1` features.
- If stable, merge `gemini-replatform` into `main` and release `v1.7.1`.
- Begin planning/implementation of `v1.7.2` (Dashboard Visibility & Import Fixes) based on previous plan.

## Configuration & Credentials (for Local Development)
To test the full authentication flow, you will need to set these environment variables (in `server/.env` and `client/.env` or `client/vite.config.ts` for `VITE_` prefixed ones):

-   **`GOOGLE_CLIENT_ID`**: Your Google OAuth Client ID.
    -   *Frontend:* `VITE_GOOGLE_CLIENT_ID` (e.g., in `client/.env.local`).
    -   *Backend:* `GOOGLE_CLIENT_ID` (e.g., in `server/.env`).
-   **`JWT_SECRET`**: A long, random string for signing JWTs.
-   **`ENCRYPTION_KEY`**: A 32-character (256-bit) random string for encrypting user credentials in the database.

## Local Testing Instructions

Follow these steps to run the replatformed application locally:

1.  **Switch to the `gemini-replatform` branch:**
    ```bash
    git checkout gemini-replatform
    ```

2.  **Start the Database (Docker):**
    ```bash
    docker-compose up -d db
    ```
    *Wait a few seconds for the PostgreSQL container to fully initialize.*

3.  **Setup Environment Variables:**
    *   **Backend (`server/.env`):**
        Create or update `server/.env` with `JWT_SECRET` and `ENCRYPTION_KEY`.
        ```
        # server/.env
        JWT_SECRET="your-very-long-and-secret-jwt-key" # Must be strong
        ENCRYPTION_KEY="your-32-char-encryption-key-here" # Must be 32 chars
        GOOGLE_CLIENT_ID="your-google-client-id-for-backend-verification" # Required for actual Google Login
        ```
    *   **Frontend (`client/.env.local`):**
        Create `client/.env.local` in the `client/` directory with `VITE_GOOGLE_CLIENT_ID`.
        ```
        # client/.env.local
        VITE_GOOGLE_CLIENT_ID="your-google-client-id-for-frontend-login" # Required for actual Google Login
        ```
        *(Note: `VITE_` prefixed variables are automatically exposed to client-side code by Vite.)*

4.  **Run Prisma Migrations (Backend):**
    ```bash
    cd server
    npx prisma migrate dev
    cd ..
    ```
    *(This applies new schema changes (User model) and generates the Prisma client.)*

5.  **Start the Backend API & WebSocket Server (Terminal 1):**
    ```bash
    cd server
    npm run dev
    ```

6.  **Start the Frontend Development Server (Terminal 2):**
    ```bash
    cd client
    npm run dev
    ```

7.  **Access the App:**
    *   Open `http://localhost:5173`.
    *   You will be greeted by the Login screen.
    *   **Option A (Full Google Login):** If you've configured `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` with a real Google project and set up authorized JavaScript origins (`http://localhost:5173`), you can click "Sign in with Google".
    *   **Option B (Bypass for Dev):** Click the **"Dev Login (Bypass)"** button (small text below the Google button). This will log you in as a dummy "Dev User" without Google credentials.

8.  **Test Functionality:**
    *   Navigate to the **Configure** tab.
    *   Enter your PagerDuty credentials (API Token, Global Routing Key, From Email).
    *   Click **"Save to Profile"**. This will encrypt and store them in the database for your logged-in user.
    *   Refresh the page. Your credentials should be pre-filled from your profile.
    *   Try **"Load Teams"** and **"Load Services & Policies"**.
    *   Go to the **Monitor** tab. Click **"Start"**. You should see the simulation status change to "Running" and incidents appear.
    *   Open a new browser tab/window to `http://localhost:5173`. You should still be logged in, and if a simulation is running, it should re-sync and display its state.
    *   **Import Crux:** Go to Campaigns tab, click Import, select your Crux JSON file.
    *   **Dynamic Payloads:** Create a new campaign, add a step with a payload like `{"summary": "Test: {{faker.lorem.words}}", "custom_details": {"user": "{{faker.internet.userName}}"}}`. Trigger it and check PagerDuty.
