# PagerDuty Incident Noise Simulator

PagerDuty Incident Noise Simulator is a lightweight front-end + proxy bundle that lets you generate realistic noise against a PagerDuty account. It is designed for demos, training, and customer simulations where you need to exercise Global Event Orchestration, service routing, responder requests, and notes without relying on real incidents.

## Highlights
- Browser UI powered by React (loaded via Babel) with persistent state in `localStorage`.
- Express-based proxy that wraps the PagerDuty REST & Events APIs so the browser never exposes secrets directly.
- Dual-view experience: **Configure** for setup, **Monitor** for live incident dashboards with filters, trend chart, and one-click clean-up.
- Team-aware service selection with collapsible sections and quick “Select Team” actions.
- Automatic incident scheduling, notes, ack/resolve timing, and responder requests that respect severity probabilities.
- Responder requests resolve the configured “From Email” to a real PagerDuty user ID before making API calls, preventing 404/2100 errors.

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

### Resume Existing Incidents

Before starting you can keep the **Resume existing PagerDuty incidents** toggle enabled (default). The simulator will pull any triggered/acknowledged incidents for the services you included so unfinished noise from a previous session shows up immediately with a “Synced” badge in the Monitor tab.

## Key Behaviors
- **Local storage persistence**: All settings stick between sessions under the `pdns_settings_v7` key.
- **Team filtering**: Teams starting with `NOC - ` and `SRE - ` are hidden for the simulated customer scenario.
- **Service severity defaults**: Incidents trigger with a 20/40/25/15 Info/Warning/Error/Critical distribution.
- **Responder requests**: The simulator caches the user ID associated with the supplied email and sends PagerDuty-compliant payloads (`requester_id`, `message`, `responder_request_targets`).
- **Auto actions**: Incidents can auto-ack, auto-resolve, generate notes, and raise responder requests using configuration sliders.
- **Info suppression**: Info-level triggers are sent to PagerDuty but intentionally skipped from the simulator’s tracking loop to reduce mapping/API chatter.
- **Monitor tooling**: Trend chart samples the last 15 minutes every 30 seconds; table supports filters, sorting, incident detail drawer, and a “Resolve All” helper.
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

## License

This project is provided as-is for demo purposes. Adjust licensing as needed for your organization.
