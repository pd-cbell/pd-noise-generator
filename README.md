# PagerDuty Incident Noise Simulator

PagerDuty Incident Noise Simulator is a lightweight front-end + proxy bundle that lets you generate realistic noise against a PagerDuty account. It is designed for demos, training, and customer simulations where you need to exercise Global Event Orchestration, service routing, responder requests, and notes without relying on real incidents.

## Highlights
- Browser UI powered by React (loaded via Babel) with persistent state in `localStorage` (see `App.jsx` for the Configure/Monitor shell).
- Express-based proxy that wraps the PagerDuty REST & Events APIs so the browser never exposes secrets directly (implemented in `server.js`).
- Dual-view experience: **Configure** for setup, **Monitor** for live incident dashboards with filters, trend chart, and one-click clean-up (view logic in `App.jsx`).
- Template library on the Configure tab lets you save/load local presets so presenters can jump between demo scenarios quickly (Template UI in `App.jsx`).
- Team-aware service selection with collapsible sections and quick “Select Team” actions (UI helpers live in `PD Incident Noise Simulator.jsx`).
- Automatic incident scheduling, notes, ack/resolve timing, and responder requests that respect severity probabilities (scheduler + automation lives in `PD Incident Noise Simulator.jsx`).
- Responder requests resolve the configured “From Email” to a real PagerDuty user ID before making API calls, preventing 404/2100 errors (front-end caching in `PD Incident Noise Simulator.jsx`, proxy calls in `server.js`).
- Failure campaigns can emit related PagerDuty Change Events (types `events_api_v2_inbound_integration` and `change_event_transform_inbound_integration`) for selected services so demos include correlated deployments (campaign logic + UI toggles in `PD Incident Noise Simulator.jsx` and change proxies in `server.js`).

## Requirements
- Node.js 16+
- PagerDuty REST API token with `incidents.write` scope.
- PagerDuty Events v2 Global Routing Key.
- A PagerDuty user email that matches the “From Email” field in the UI.
- Dynamic Routing rule that keys off `event.payload.custom_details.service_name` so incidents land on the same PagerDuty service that the simulator triggers.

## Getting Started

```bash
git clone https://github.com/pd-cbell/pd-noise-generator.git
cd pd-noise-generator
npm install
cp .env.example .env
```

Edit `.env` with the values for your PagerDuty account:

```bash
PORT=3001
PD_FROM_EMAIL=automation@pagerduty.com
PD_API_BASE=https://api.pagerduty.com
```

> `PD_FROM_EMAIL` must match a PagerDuty user that has permission to add responders. The UI “From Email” field can be changed per session; if it differs from the env value the proxy will forward the browser-supplied value.

Start the proxy and static assets:

```bash
npm start
```

Visit `http://localhost:3001` and populate the UI with:

1. Subdomain, REST API token, Global Routing Key, and From Email.
2. Load teams/services/escalation policies.
3. Select the services you want to simulate (per-team toggles help keep noise targeted).
4. Press **Start** to begin the Poisson incident generation loop.

### Running with Docker Compose

The repository ships with a simple Docker setup so you can run the proxy/UI locally or drop it into an orchestrator:

```bash
cp .env.example .env  # add your PagerDuty credentials
docker compose up --build
```

The service listens on `PORT` (defaults to `3001`) and uses the same `.env` values that `npm start` expects.

### Auto-Heal Warnings

In the Configure tab you can enable **Auto-Heal Events** to automatically resend an OK event for a percentage of warning incidents. Configure:

- **Enable toggle** – master switch.
- **% of warnings** – probability (default 20%) that a warning incident auto-heals.
- **Min/Max delay** – randomized window (default 30–90 seconds) before the OK event is sent.

This is handy for demonstrating PagerDuty Auto-Pause, as alerts will self-resolve without manual action.

### Observability Payload Mix

Use the **Observability Payload Mix** sliders to control how often incidents mimic CloudWatch alarms, Datadog monitors, New Relic APM traces, or Splunk log signatures. Each template has unique `summary`, `source`, and `custom_details` metadata so demos feel closer to real telemetry.

### Failure Campaigns

Enable **Failure Campaigns** to simulate correlated incidents across services in the same team. When a campaign triggers, siblings fire within a configurable window and share a `failure_id` / summary so the Monitor view can highlight the common cause.

When services have PagerDuty Change Events integrations (type `events_api_v2_inbound_integration` or `change_event_transform_inbound_integration`) and are included in the run, the simulator will also emit 1–3 related change events per campaign using those integration keys. The Configure tab surfaces which teams have change coverage and lets you disable change emissions if needed.

#### Verifying Change Coverage

```bash
curl -s \
  -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  -H "Accept: application/vnd.pagerduty+json;version=2" \
  -H "From: automation@pagerduty.com" \
  "https://api.pagerduty.com/services?limit=100&include[]=integrations" |
jq '.services[]
    | {id, name,
       change_integrations: [
         .integrations[]?
         | select(.type=="events_api_v2_inbound_integration"
                  or .type=="change_event_transform_inbound_integration")
         | {id, name, integration_key}
       ]}
    | select(.change_integrations|length>0)'
```

The Configure view logs `services=… withChange=…` when it detects these integrations and automatically enables the “Emit related change events” toggle once at least one included service exposes an integration key.

### Resume Existing Incidents

Before starting you can keep the **Resume existing PagerDuty incidents** toggle enabled (default). The simulator will pull any triggered/acknowledged incidents for the services you included so unfinished noise from a previous session shows up immediately with a “Synced” badge in the Monitor tab.

### Template Library

Use the **Template Library** card on the Configure tab (implemented in `App.jsx`) to manage presets for common demos:

1. Configure the run (teams, services, sliders) then provide a name/optional description and click **Save Template**.
2. Templates are stored locally under the `pdns_template_library_v1` key; REST API tokens and routing keys are never persisted.
3. Each saved template shows quick stats (rate, auto-heal, resume, change events, failure campaign settings) with **Load**, **Overwrite**, and **Delete** actions.
4. Loading a template populates the Configure form immediately, and Monitor now surfaces the “Last run template” label plus start-up log entries (e.g., `Simulation started (template: Customer Warmup)`).

## Key Behaviors
- **Local storage persistence**: All settings stick between sessions under the `pdns_settings_v7` key.
- **Team filtering**: Teams starting with `NOC - ` and `SRE - ` are hidden for the simulated customer scenario.
- **Service severity defaults**: Incidents trigger with a 20/40/25/15 Info/Warning/Error/Critical distribution.
- **Responder requests**: The simulator caches the user ID associated with the supplied email and sends PagerDuty-compliant payloads (`requester_id`, `message`, `responder_request_targets`).
- **Auto actions**: Incidents can auto-ack, auto-resolve, generate notes, and raise responder requests using configuration sliders.
- **Info suppression**: Info-level triggers are sent to PagerDuty but intentionally skipped from the simulator’s tracking loop to reduce mapping/API chatter.
- **Monitor tooling**: Trend chart samples the last 15 minutes every 30 seconds; table supports filters, sorting, incident detail drawer, and a “Resolve All” helper.
- **Change coverage awareness**: Scans selected services for change-event integrations and emits correlated change events during failure campaigns when coverage exists.
- **Auto-heal warnings**: Optional OK events resolve ~20% of warning incidents within a configurable window to showcase auto-pause flows.
- **Resume support**: Optionally pulls real triggered/acknowledged incidents for the included services at startup so demos can pick up unattended noise.
- **Observability diversity**: Payload templates for CloudWatch, Datadog, New Relic, and Splunk styles with configurable weights.
- **Campaign correlation**: Failure campaigns share IDs/summaries across services to demonstrate cross-service troubleshooting.

## Development Notes
- The browser bundle is intentionally kept simple (Babel in the browser). For production use you may wish to move to a build step.
- The Express proxy is also minimal—no session management or rate limiting is included.
- The proxy exposes `/proxy/users` specifically so the front-end can resolve user IDs by email.

## Releasing

This repository uses standard git tags for release tracking. Upcoming releases can follow the same pattern:

```bash
git commit -am "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

Current release: **v1.1.0**

## Active Workstreams
- `v1.3` stabilizes the change-event pipeline and resume workflows captured in `docs/SESSION_NOTES.md`.
- `v1.3.1` expands the new template library/UI so presenters can load, overwrite, and delete saved configuration payloads directly from the browser (see `docs/SESSION_NOTES.md` and `docs/AGENT_NOTES.md` for design details).

## License

This project is provided as-is for demo purposes. Adjust licensing as needed for your organization.
