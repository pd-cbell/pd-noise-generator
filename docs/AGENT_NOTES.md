# Agent Notes

These notes help future pairing sessions or automation agents quickly orient themselves when working on the PagerDuty Incident Noise Simulator.

## Environment & Setup
- Node 16+ required. The project ships without a build step; `npm start` runs the Express proxy and serves the React UI.
- Use `.env` (copy from `.env.example`) to set `PD_FROM_EMAIL`, `PORT`, and optional `PD_API_BASE`.
- For UI testing, supply valid PagerDuty credentials in the browser (REST API token, Global Routing Key, From Email). Profiles keep these values in `localStorage` under `pdns_profiles_v1`.
- LocalStorage (via profiles) now also persists the active view (“configure” vs “monitor”), monitor filters/sort state, and template metadata so the dashboard re-opens exactly how a user left it.
- Docker support: build with `docker compose up --build` (defaults to port 3001 and consumes the same `.env` file). Update `.env` before composing; `.dockerignore` prevents leaking local credentials into the image layers.
- Auto-heal settings live under `autoHealConfig` in localStorage; defaults are enabled, 20% chance, 30–90s delay. Config UI writes sanitized values (0-100% and non-negative seconds).
- Resume toggle lives under `resumeExistingEnabled`; when true the simulator calls `/proxy/incidents` for selected services before each run and tags synced incidents in the Monitor table.
- Services are fetched with `include[]=integrations`; change integrations are detected by type (`events_api_v2_inbound_integration`, `change_event_transform_inbound_integration`) and stored per service so failure campaigns can emit related change events.
- Template library data lives under the `pdns_template_library_v1` localStorage key; entries include metadata + sanitized settings (no REST API tokens or routing keys). UI/actions live in `App.jsx`.
- Profiles live under `pdns_profiles_v1` and wrap every Configure setting (credentials, selections, sliders, filters). Legacy `pdns_settings_v7` payloads migrate into a Default Profile automatically on upgrade.
- Payload registry auto-registers built-in templates plus any JSON imports dropped into `/templates` (e.g., `payload_import.ms.json`). Adapters can opt into campaigns and supply metadata used by the UI.

## Current Workstreams
- **v1.3** – consolidate the change-event plumbing plus resume workflows already landed in `server.js` and `PD Incident Noise Simulator.jsx`. Expect continued refactors to the change-event toggle and logging.
- **v1.3.1** – expand the new template library + front-end picker so presenters can store/load configuration presets locally. Upcoming work: evaluate import/export flows, schema versioning, and whether `/proxy/templates` is needed beyond browser storage.

## Template Library
- Configure tab now includes a Template Library card (see `App.jsx`). Users can name/describe a preset, hit **Save Template**, then Load/Overwrite/Delete entries from the list.
- Data persists in localStorage (`pdns_template_library_v1`). We intentionally omit REST API tokens and routing keys; only presentation-friendly settings are stored.
- Loading a template hydrates Configure state immediately, logs an info entry, and marks the template as active. The Monitor view surfaces “Last run template” using the name captured at `start()`.
- Overwrite rewrites the existing entry using the current state snapshot, bumping `updatedAt` so the list remains sorted (newest first).
- Delete removes the entry locally only; instruct presenters to export separately if they need to share presets (future enhancement may sync via `/proxy/templates`).

## Campaigns & Payload Templates
- Dedicated **Campaigns** tab consolidates failure campaign probability/window controls, template selection, and change-event toggles.
- Change-event toggle now surfaces coverage stats (team count, included services) so presenters know when /proxy/change_events can fire.
- Campaign template picker can run in “All adapters” mode or “Select templates manually”. Imported adapters (e.g., Crux payloads) appear alongside CloudWatch/Datadog/NewRelic/Splunk built-ins.
- The Payload Registry table shows every adapter plus vendor/description metadata; dropping files like `payload_import.ms.json` into the `/templates` folder registers additional adapters automatically on load (and exposes a **Trigger Now** action for the bundled campaign).
- When campaigns fire, we omit `dedup_key` so PagerDuty’s Events API assigns one (helping alert grouping); the simulator records the key returned in the response.
- Imported campaign steps marked with `event_type = change` require a user-supplied change routing key (input on the Campaigns tab); those events are routed through `/proxy/change_events`.

## Profiles
- Configure tab includes a Profiles card with Active Profile dropdown, New Profile button, and form inputs for name/description.
- Profiles auto-sync settings as users edit; **Save** refreshes the metadata timestamp, while **Save As** clones the current configuration into a new entry.
- Data is stored per browser under `pdns_profiles_v1` (`{ activeProfileId, profiles: [...] }`). Existing `pdns_settings_v7` data migrates once during first load.
- Deleting a profile requires at least one remaining entry; selecting another profile hydrates Configure immediately.
- Migration banner appears after upgrade so presenters know where their legacy settings landed (Default Profile) and can dismiss once acknowledged.

## Key Endpoints
- Proxy routes under `/proxy/...` forward to PagerDuty REST APIs using the server-side `From` header.
- `/proxy/users` is critical for resolving the `requester_id`; do not remove unless replacing the flow.
- Responder requests must include top-level `requester_id`, `message`, and `responder_request_targets`.
- `/proxy/change_events` mirrors PagerDuty’s change enqueue endpoint so the browser never exposes integration keys directly.

## Common Pitfalls
- If responder requests return 404/2100, verify the From Email maps to an actual PagerDuty user and that the cached user ID is refreshing (changing the email clears the cache).
- Hidden teams are determined by prefixes (`NOC - `, `SRE - `); adjust `HIDDEN_TEAM_PREFIXES` if customer naming conventions change.
- Because the UI fetches directly from the proxy, CORS and auth headers are handled in `server.js`; changing the proxy structure requires updates in both layers.
- Monitor tab skips INFO incidents on purpose—do not re-add them to the active queue unless you also revisit the performance prize for PD mapping calls.
- Auto-heal logic runs even when the simulator is paused (dedicated ticker). Make sure `PD_FROM_EMAIL` and routing key remain valid so resolve events succeed.
- Failure campaigns require services sharing at least one team; they push `failure_id`/`failure_summary` into `custom_details` so UI badges can cluster incidents.
- Observability templates now live in the payload registry inside `App.jsx`; adjust `sourceMix` weights (0–1) if you want to bias toward a particular tool.
- Change events only emit when the Configure toggle is enabled **and** the selected services have change integrations. Lack of coverage automatically disables the toggle.

## Testing Guidance
- No automated tests yet; manual validation through the browser and curl is the current approach.
- When adding features, consider wiring a lightweight script (Node or Playwright) to hit the proxy with mocked responses.
- Use the Monitor tab’s “Resolve All” button to clear state between manual tests instead of refreshing the entire page.
- To verify auto-heal, filter the Monitor table to warnings and watch for the green “Auto-heal in …” badge/countdown; logs show `Auto-healing` messages plus the final resolve.
- To confirm resume behavior, start a run with the toggle enabled and watch for “Resumed N incidents” log entries plus gray “Synced” badges in Monitor.
- For failure campaigns, look for the rose failure badge plus shared summaries; adjust settings to increase probability during tests.
- For change events, watch the log for “Sent change event…” entries and ensure your services expose a supported integration type; the Configure tab’s coverage summary should list teams with change-enabled services.
- To double-check coverage outside the UI, run:
  ```bash
  curl -s \
    -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
    -H "Accept: application/vnd.pagerduty+json;version=2" \
    -H "From: automation@pagerduty.com" \
    "https://api.pagerduty.com/services?limit=100&include[]=integrations" |
  jq '.services[] | {id,name,change_integrations:[.integrations[]? | select(.type=="events_api_v2_inbound_integration" or .type=="change_event_transform_inbound_integration") | {id,name,integration_key}]} | select(.change_integrations|length>0)'
  ```

## Release Process
1. Update docs/notes as needed.
2. Commit changes with a descriptive message (e.g., `chore: release vX.Y.Z`).
3. Tag the release (`git tag vX.Y.Z`) and push (`git push origin main --tags`).

## Future Ideas
- Add CLI seeding of demo data (mock services/teams) for offline usage.
- Provide optional Dockerfile to encapsulate the proxy + static assets.
- Introduce modular configuration (YAML/JSON) to share presets across customers.
- Build automated smoke tests that watch the 15-minute trend data and table filters to guard against Monitor regressions.
