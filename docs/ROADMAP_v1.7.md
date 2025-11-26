# Roadmap v1.7: Identity & Platform Replatform

This plan outlines the steps required to transition the PagerDuty Noise Simulator from a local-first, single-user browser tool to a multi-user, server-side-driven application with robust authentication and persistent cloud storage.

## High-Level Goals
- Implement Google OAuth for user authentication.
- Support multiple users with scoped data access (Profiles, Campaigns).
- Move simulation execution to the backend, enabling headless operation and session persistence.
- Securely store user-specific PagerDuty credentials.
- Enhance cloud deployment with managed database options.

---

## Phase 1: Authentication & User Management

### 1.1 Implement Google OAuth
- **Backend:**
    - Choose and integrate an OAuth strategy (e.g., Passport.js-Google or `google-auth-library` for token verification).
    - Create `/auth/google` and `/auth/google/callback` endpoints.
    - Implement JWT generation and session management (e.g., httpOnly cookies for session JWT).
    - **Database Schema Update:**
        - Create a new `User` model: `id` (PK), `googleId` (unique), `email` (unique), `name`, `avatarUrl`, `createdAt`, `updatedAt`.
- **Frontend:**
    - Add "Sign in with Google" button/component.
    - Implement logic to send `id_token` to backend for verification and session establishment.
    - Implement authentication context and state management for logged-in user.

### 1.2 Multi-User Data Scoping
- **Database Schema Update:**
    - Modify existing models to establish user ownership:
        - `Profile` model: Add `userId` (FK to `User.id`), `User` relation.
        - `Campaign` model: Add `userId` (FK to `User.id`), `User` relation.
- **Backend (API Layer):**
    - Implement an authentication middleware (`authenticateUser`) to extract `req.user.id` from the JWT.
    - Modify all `Profile` and `Campaign` API endpoints (`GET`, `POST`, `PUT`, `DELETE`) to filter/scope data by the authenticated `userId` (e.g., `where: { userId: req.user.id }`).
    - Handle scenarios for data creation (assign `userId` from `req.user.id`).
- **Frontend:**
    - Update `useStore.ts` `fetch*` actions (e.g., `fetchProfiles`, `fetchCampaigns`) to implicitly fetch user-scoped data.
    - Update UI components to respect user ownership (e.g., only display current user's campaigns).

### 1.3 Secure User Credentials Storage
- **Backend:**
    - Choose and integrate an encryption/decryption mechanism (e.g., Node.js `crypto` module with AES-256 GCM).
    - Create a secure environment variable for an encryption key.
    - Implement utility functions for `encrypt(plaintext)` and `decrypt(ciphertext)`.
    - **Database Schema Update:**
        - Update `User` model (or create `UserCredential` model): Add `encryptedPagerDutyApiToken` (String), `encryptedGlobalRoutingKey` (String), `encryptedFromEmail` (String).
- **Frontend (CampaignEditor/ConfigurationForm):**
    - Add UI fields for "Save PagerDuty Credentials to Profile" (User API Token, Global Routing Key, From Email).
    - Implement logic to send these credentials to the backend for encryption and storage.
    - Implement logic to fetch and decrypt these credentials when needed (e.g., to hydrate the Configuration form, or for Server-Side Simulation).

---

## Phase 2: Server-Side Simulation Engine

### 2.1 Port Simulation Logic to Backend
- **Backend (`SimulationEngine` Rewrite):**
    - Create new backend service classes (e.g., `ServerSimulationEngine`, `SimulationRunner`) within `server/src/services`.
    - Port the core logic from `client/src/services/SimulationEngine.ts` and relevant parts of `client/src/store/useStore.ts` (`evalTick`, `triggerIncident`, `ackIncident`, `resolveIncident`) to the backend.
    - These backend services will interact directly with the PagerDuty API (bypassing the proxy now that credentials are server-side).
    - Implement a mechanism for the `ServerSimulationEngine` to track active simulations across users (e.g., an in-memory map keyed by `userId`).
- **Frontend (Client-Side `SimulationEngine` Deprecation):**
    - Remove or refactor `client/src/services/SimulationEngine.ts`. The client will become a "remote control" for the server.

### 2.2 Real-time Communication (WebSockets)
- **Backend:**
    - Integrate `Socket.io` (or similar WebSocket library) into the Express app.
    - Implement WebSocket handlers to:
        - Authenticate incoming connections by `userId`.
        - Push real-time updates (incidents triggered, metrics, logs) from the `ServerSimulationEngine` to connected clients.
        - Listen for client commands (e.g., `startSimulation`, `pauseSimulation`, `stopSimulation`, `resolveAllIncidents`).
- **Frontend:**
    - Implement `Socket.io` client to connect to the backend WebSocket.
    - Update `MonitorDashboard.tsx` to display real-time data received from the WebSocket.
    - Update `Header.tsx` (Start/Pause/Stop buttons) to send commands via WebSocket.

### 2.3 Session Persistence & Reconnection
- **Backend (`ServerSimulationEngine`):**
    - When a client connects, check if an active simulation already exists for that `userId`.
    - If yes, send the current state of the simulation (active incidents, current metrics) to the client.
    - If no client is connected, the simulation continues running headless on the server.
- **Frontend:**
    - On page load/login, check for existing server-side simulation and re-hydrate UI from its state.

---

## Phase 3: Cloud Deployment Enhancements

### 3.1 Managed Database (AWS RDS)
- **CloudFormation Update (`deploy/aws-cfn.yaml`):**
    - Add a new `AWS::RDS::DBInstance` resource (PostgreSQL engine) with appropriate `DBSubnetGroup` and `DBSecurityGroup`.
    - Parameterize DB credentials (username, password, instance type).
    - Update `api` service `DATABASE_URL` environment variable to connect to the RDS endpoint.
    - Ensure secure handling of DB credentials (e.g., AWS Secrets Manager or KMS-encrypted parameters).
- **Backend (Prisma):**
    - Ensure Prisma client is configured to connect to the RDS instance.
- **Migration Strategy:**
    - Plan for migrating existing local data (if any) to RDS, or start with a fresh cloud database.

### 3.2 Scaling Considerations (Future)
- **CloudFormation:** While not in v1.7 scope, lay groundwork for horizontal scaling:
    - ECS Fargate tasks for `api` and `web` services.
    - Load Balancers for traffic distribution.
    - Centralized logging and monitoring.

---

## Deliverables for v1.7
- Fully functional Google OAuth login/logout.
- User-scoped Profiles and Campaigns.
- Backend-driven simulation that runs headless.
- Real-time monitoring dashboard via WebSockets.
- Secure storage and retrieval of user PagerDuty credentials.
- CloudFormation template supporting RDS.

This is a comprehensive overhaul, and each sub-task requires careful planning and incremental implementation.
