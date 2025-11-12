# Agent Notes

These notes help future pairing sessions or automation agents quickly orient themselves when working on the PagerDuty Incident Noise Simulator.

## Environment & Setup
- Node 16+ required. The project ships without a build step; `npm start` runs the Express proxy and serves the React UI.
- Use `.env` (copy from `.env.example`) to set `PD_FROM_EMAIL`, `PORT`, and optional `PD_API_BASE`.
- For UI testing, supply valid PagerDuty credentials in the browser (REST API token, Global Routing Key, From Email). The simulator stores data in `localStorage` under `pdns_settings_v7`.
- LocalStorage now also persists the active view (“configure” vs “monitor”) and monitor filters/sort state so the dashboard re-opens exactly how a user left it.
- Docker support: build with `docker compose up --build` (defaults to port 3001 and consumes the same `.env` file). Update `.env` before composing; `.dockerignore` prevents leaking local credentials into the image layers.
- Auto-heal settings live under `autoHealConfig` in localStorage; defaults are enabled, 20% chance, 30–90s delay. Config UI writes sanitized values (0-100% and non-negative seconds).
- Resume toggle lives under `resumeExistingEnabled`; when true the simulator calls `/proxy/incidents` for selected services before each run and tags synced incidents in the Monitor table.

## Key Endpoints
- Proxy routes under `/proxy/...` forward to PagerDuty REST APIs using the server-side `From` header.
- `/proxy/users` is critical for resolving the `requester_id`; do not remove unless replacing the flow.
- Responder requests must include top-level `requester_id`, `message`, and `responder_request_targets`.

## Common Pitfalls
- If responder requests return 404/2100, verify the From Email maps to an actual PagerDuty user and that the cached user ID is refreshing (changing the email clears the cache).
- Hidden teams are determined by prefixes (`NOC - `, `SRE - `); adjust `HIDDEN_TEAM_PREFIXES` if customer naming conventions change.
- Because the UI fetches directly from the proxy, CORS and auth headers are handled in `server.js`; changing the proxy structure requires updates in both layers.
- Monitor tab skips INFO incidents on purpose—do not re-add them to the active queue unless you also revisit the performance prize for PD mapping calls.
- Auto-heal logic runs even when the simulator is paused (dedicated ticker). Make sure `PD_FROM_EMAIL` and routing key remain valid so resolve events succeed.
- Failure campaigns require services sharing at least one team; they push `failure_id`/`failure_summary` into `custom_details` so UI badges can cluster incidents.
- Observability templates are defined in `OBS_SOURCE_TEMPLATES`. Adjust `sourceMix` weights (0–1) if you want to bias toward a particular tool.

## Testing Guidance
- No automated tests yet; manual validation through the browser and curl is the current approach.
- When adding features, consider wiring a lightweight script (Node or Playwright) to hit the proxy with mocked responses.
- Use the Monitor tab’s “Resolve All” button to clear state between manual tests instead of refreshing the entire page.
- To verify auto-heal, filter the Monitor table to warnings and watch for the green “Auto-heal in …” badge/countdown; logs show `Auto-healing` messages plus the final resolve.
- To confirm resume behavior, start a run with the toggle enabled and watch for “Resumed N incidents” log entries plus gray “Synced” badges in Monitor.
- For failure campaigns, look for the rose failure badge plus shared summaries; adjust settings to increase probability during tests.

## Release Process
1. Update docs/notes as needed.
2. Commit changes with a descriptive message (e.g., `chore: release vX.Y.Z`).
3. Tag the release (`git tag vX.Y.Z`) and push (`git push origin main --tags`).

## Future Ideas
- Add CLI seeding of demo data (mock services/teams) for offline usage.
- Provide optional Dockerfile to encapsulate the proxy + static assets.
- Introduce modular configuration (YAML/JSON) to share presets across customers.
- Build automated smoke tests that watch the 15-minute trend data and table filters to guard against Monitor regressions.
