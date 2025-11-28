# Roadmap v1.7.1: Dynamic Payloads, Reliable Operations & Imports

This plan focuses on improving the robustness of the server-side simulation engine, addressing observed issues with incident management and API rate limiting, and integrating new features like dynamic payloads and server-side campaign import.

---

## High-Level Goals
- Implement dynamic payload generation using Faker.js.
- Ensure reliable incident resolution and responder requests, even under load.
- Implement intelligent API rate limiting for PagerDuty REST API calls.
- Re-implement Crux campaign import functionality on the backend for robustness.

---

## Phase 1: API Stability & Performance

### 1.1 Implement Bulk Operations for Incident Management
- **Goal:** Reduce PagerDuty REST API calls for Acknowledge and Resolve actions by batching.
- **Backend (`PagerDutyClient.ts`):**
    - Add `manageIncidentsBatch(incidentIds: string[], action: 'acknowledge' | 'resolve')` method. This method will use PagerDuty's multi-update incident API endpoint.
- **Backend (`ServerSimulationEngine.ts`):**
    - Modify `tick()` loop: Instead of calling `ackIncident` or `resolveIncident` immediately for each incident, queue the incident IDs that need action.
    - At the end of `tick()`, call `pdClient.manageIncidentsBatch` with the collected IDs.
    - This will require re-thinking the individual `ackIncident`/`resolveIncident` methods to update `SimulationState` without directly hitting the API. They will now queue the action.

### 1.2 Implement Intelligent Rate Limiting
- **Goal:** Prevent 429 Too Many Requests errors against the PagerDuty REST API.
- **Backend (`PagerDutyClient.ts` / new utility):**
    - Integrate a token bucket rate limiter (e.g., using a library or custom implementation).
    - All `pdClient.request()` calls (for REST API, not Events API) should pass through this limiter.
    - Implement a retry mechanism with exponential backoff for 429 responses.
- **Backend (`ServerSimulationEngine.ts`):**
    - Add metrics for rate limiter performance (e.g., requests queued, requests dropped).
    - Emit these metrics in `sim_tick`.

### 1.3 Fix Responder Requests
- **Goal:** Enable and correctly handle PagerDuty responder requests.
- **Backend (`PagerDutyClient.ts`):**
    - Add `getUsersByEmail(email: string[])` method to fetch user IDs by email.
- **Backend (`ServerSimulationEngine.ts`):**
    - Implement an in-memory cache for `email -> userId` mapping.
    - When a responder request is triggered, first try to resolve the email from the cache. If not found, call `pdClient.getUsersByEmail` and cache the result.
    - Call `pdClient.requestResponder(incidentId, userId)` (requires implementing this in `PagerDutyClient.ts`).

---

## Phase 2: Dynamic Payloads & Server-Side Import

### 2.1 Dynamic Payloads (Faker.js Integration)
- **Goal:** Allow dynamic content generation in incident payloads.
- **Backend:**
    - Install `@faker-js/faker` development dependency.
    - Create a `TemplateParser` utility (`server/src/utils/TemplateParser.ts`). This class will:
        - Take a string payload (JSON or any text).
        - Scan for `{{faker.module.method}}` patterns.
        - Replace patterns with actual Faker.js generated data.
- **Backend (`ServerSimulationEngine.ts`):**
    - Before triggering any event (`pdClient.triggerEvent`, `pdClient.triggerChangeEvent`), pass the payload through the `TemplateParser`.

### 2.2 Server-Side Import (Crux Campaigns)
- **Goal:** Provide a robust, server-side mechanism to import Crux campaign JSON.
- **Backend (`api/campaigns/import` route):**
    - Add `POST /api/campaigns/import` endpoint to `server/src/routes/campaigns.ts`.
    - This endpoint will accept a JSON payload (the Crux export).
    - It will parse the Crux format (`event_group` array).
    - For each event group, it will call `prisma.campaign.create` (similar to `importCampaignFromCrux` in the frontend store).
    - Assign the imported campaigns to the authenticated user (`req.user.userId`).
- **Frontend (`CampaignManager.tsx`):**
    - Restore the "Import (Crux)" button and file input.
    - Modify `handleFileChange` to send the parsed JSON content to the new `POST /api/campaigns/import` endpoint instead of calling a local store action.
    - Update the `useStore` to remove `importCampaignFromCrux` as it's now backend-driven.

---

## Deliverables for v1.7.1
- PagerDuty API bulk actions (Ack/Resolve).
- Rate limiting on PagerDuty REST API calls.
- Functional responder requests with user ID caching.
- Dynamic payload generation using Faker.js templates.
- Server-side Crux campaign import via API endpoint.

This robust plan addresses the identified issues and introduces significant enhancements for the simulation's realism and reliability.
