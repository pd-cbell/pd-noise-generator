# Agent Notes - v1.7 Replatform

**Branch:** `gemini-replatform`

## Status: Phase 1 & 2 Complete (Core Logic Replatformed)

### Completed
- **Phase 1.1: Authentication (Google OAuth)**
    - Added `User` model to Prisma schema.
    - Implemented Google OAuth flow on backend (`/auth/google`) for `id_token` verification, user upsert, JWT session creation, and `httpOnly` cookie setting.
    - Implemented `AuthContext.tsx` in frontend for user state, login/logout, and session checking (`/auth/me`).
    - Integrated `GoogleOAuthProvider` and `AuthProvider` in `client/src/main.tsx`.
    - Created `Login.tsx` component, used in `client/src/App.tsx` for route protection.
    - Added **Development Login Bypass** (`POST /auth/dev-login`) and corresponding UI button in `Login.tsx` for easy local testing without Google API setup.
- **Phase 1.2: Multi-User Data Scoping**
    - Updated `Profile` and `Campaign` Prisma models with `userId` (optional for existing records).
    - Created `authenticateUser` middleware (`server/src/middleware/auth.ts`).
    - Applied middleware and scoped all CRUD operations for `profiles` and `campaigns` to the authenticated `userId`.
- **Phase 1.3: Secure User Credentials Storage**
    - Implemented AES-256 encryption/decryption utilities (`server/src/utils/crypto.ts`).
    - Added encrypted fields (`encryptedPagerDutyApiToken`, `encryptedGlobalRoutingKey`, `encryptedFromEmail`) to the `User` model.
    - Implemented `PUT /auth/credentials` on backend to save/update encrypted credentials.
    - Updated `GET /auth/me` to return decrypted credentials to the authenticated user.
    - Integrated "Save to Profile" button and pre-fill logic in `ConfigurationForm.tsx`.
- **Phase 2.1: Port Simulation Logic to Backend**
    - Created `server/src/types.ts` for shared interfaces/constants.
    - Created `server/src/utils/payloads.ts` for server-side payload generation.
    - Created `server/src/services/PagerDutyClient.ts` for backend PagerDuty API interaction.
    - Fully ported `SimulationEngine` core logic (Poisson generation, incident lifecycle, metrics, API calls) into `server/src/services/ServerSimulationEngine.ts`.
- **Phase 2.2: Real-time Communication (WebSockets)**
    - Integrated `Socket.io` on backend (`server/src/index.ts`) with JWT authentication via cookies.
    - `SimulationInstance` in `ServerSimulationEngine.ts` now emits state changes directly via `io.to(userId).emit('sim_tick', this.state)`.
    - Created `client/src/hooks/useServerSimulation.ts` to manage client-side Socket.io connection and sync server simulation state.
    - Updated `client/src/App.tsx`, `client/src/components/Header.tsx`, and `client/src/components/MonitorDashboard.tsx` to consume server-driven simulation state and controls.

### Next Major Phase
- **Phase 3: Cloud Deployment Enhancements**
    - Update CloudFormation for RDS and other production-ready features.

## Credentials Configuration (for Local Development)
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
    *   Open your browser to `http://localhost:5173`.
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

This completes the detailed notes and sets up the project for robust local testing.