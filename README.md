# PagerDuty Incident Noise Simulator

PagerDuty Incident Noise Simulator is a lightweight front-end + proxy bundle that lets you generate realistic noise against a PagerDuty account. It is designed for demos, training, and customer simulations where you need to exercise Global Event Orchestration, service routing, responder requests, and notes without relying on real incidents.

## Highlights
- Browser UI powered by React (loaded via Babel) with persistent state in `localStorage`.
- Express-based proxy that wraps the PagerDuty REST & Events APIs so the browser never exposes secrets directly.
- Team-aware service selection with collapsible sections and quick “Select Team” actions.
- Automatic incident scheduling, notes, ack/resolve timing, and responder requests that respect severity probabilities.
- Responder requests resolve the configured “From Email” to a real PagerDuty user ID before making API calls, preventing 404/2100 errors.

## Requirements
- Node.js 16+
- PagerDuty REST API token with `incidents.write` scope.
- PagerDuty Events v2 Global Routing Key.
- A PagerDuty user email that matches the “From Email” field in the UI.

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

## Key Behaviors
- **Local storage persistence**: All settings stick between sessions under the `pdns_settings_v7` key.
- **Team filtering**: Teams starting with `NOC - ` and `SRE - ` are hidden for the simulated customer scenario.
- **Service severity defaults**: Incidents trigger with a 20/40/25/15 Info/Warning/Error/Critical distribution.
- **Responder requests**: The simulator caches the user ID associated with the supplied email and sends PagerDuty-compliant payloads (`requester_id`, `message`, `responder_request_targets`).
- **Auto actions**: Incidents can auto-ack, auto-resolve, generate notes, and raise responder requests using configuration sliders.

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

Current release: **v1.0.0**

## License

This project is provided as-is for demo purposes. Adjust licensing as needed for your organization.
