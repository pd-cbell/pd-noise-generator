function App() {
  // ---------- Local Storage Helpers ----------
  const LS_KEY = 'pdns_settings_v7';
  const loadLS = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
  const saveLS = (obj) => { try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {} };

  // ---------- Org/domain + credentials ----------
  const [pdSubdomain, setPdSubdomain] = React.useState("");
  const [apiToken, setApiToken] = React.useState("");
  const [globalRoutingKey, setGlobalRoutingKey] = React.useState("");
  const [fromEmail, setFromEmail] = React.useState("");

  // ---------- Teams and Services fetched from PD ----------
  const [teams, setTeams] = React.useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState([]);
  const [services, setServices] = React.useState([]);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(false);
  const [isLoadingServices, setIsLoadingServices] = React.useState(false);

  // Persisted include-by-service-id map
  const [includeMap, setIncludeMap] = React.useState({});

  // ---------- Escalation Policies (for responder requests) ----------
  const [escalationPolicies, setEscalationPolicies] = React.useState([]); // [{id, name, html_url, num_levels, teams:[] }]
  const [isLoadingEPs, setIsLoadingEPs] = React.useState(false);
  const [selectedEPIds, setSelectedEPIds] = React.useState([]);

  // ---------- Universal responder config (critical vs non-critical) ----------
  const [universalResponderCfg, setUniversalResponderCfg] = React.useState({
    prob: { critical: 0.35, nonCritical: 0.2 },
    first: {
      critical: { minSec: 30, maxSec: 120 },
      nonCritical: { minSec: 60, maxSec: 240 },
    },
  });

  // ---------- Simulation settings ----------
  const [ratePerMinute, setRatePerMinute] = React.useState(6);
  const [noteProbability, setNoteProbability] = React.useState(0.5);
  const [responderProbabilityMultiplier, setResponderProbabilityMultiplier] = React.useState(1.0);
  const [autoResolveMinSec, setAutoResolveMinSec] = React.useState(90);
  const [autoResolveMaxSec, setAutoResolveMaxSec] = React.useState(240);
  const [severityWeights, setSeverityWeights] = React.useState({ info: 0.1, warning: 0.2, error: 0.45, critical: 0.25 });

  const [isRunning, setIsRunning] = React.useState(false);
  const [log, setLog] = React.useState([]);
  // active rec: { dedupKey, serviceId, serviceName, startedAt, incidentId, mapAttempts, nextEvalAt, ackAt, acked, firstResponderAt, responderRequested, severity }
  const [active, setActive] = React.useState([]);

  // Timers/refs for schedulers
  const fireTimerRef = React.useRef(null);
  const evalTimerRef = React.useRef(null);

  // ---------- Load from Local Storage on first mount ----------
  React.useEffect(() => {
    const st = loadLS();
    if (st.pdSubdomain) setPdSubdomain(st.pdSubdomain);
    if (st.apiToken) setApiToken(st.apiToken);
    if (st.globalRoutingKey) setGlobalRoutingKey(st.globalRoutingKey);
    if (st.fromEmail) setFromEmail(st.fromEmail);
    if (st.selectedTeamIds) setSelectedTeamIds(st.selectedTeamIds);
    if (st.universalResponderCfg) setUniversalResponderCfg(st.universalResponderCfg);
    if (st.ratePerMinute != null) setRatePerMinute(st.ratePerMinute);
    if (st.noteProbability != null) setNoteProbability(st.noteProbability);
    if (st.responderProbabilityMultiplier != null) setResponderProbabilityMultiplier(st.responderProbabilityMultiplier);
    if (st.autoResolveMinSec != null) setAutoResolveMinSec(st.autoResolveMinSec);
    if (st.autoResolveMaxSec != null) setAutoResolveMaxSec(st.autoResolveMaxSec);
    if (st.severityWeights) setSeverityWeights(st.severityWeights);
    if (st.includeMap) setIncludeMap(st.includeMap);
    if (st.selectedEPIds) setSelectedEPIds(st.selectedEPIds);
  }, []);

  // ---------- Persist settings whenever they change ----------
  React.useEffect(() => {
    const st = {
      pdSubdomain, apiToken, globalRoutingKey, fromEmail,
      selectedTeamIds, universalResponderCfg,
      ratePerMinute, noteProbability, responderProbabilityMultiplier,
      autoResolveMinSec, autoResolveMaxSec, severityWeights, includeMap,
      selectedEPIds,
    };
    saveLS(st);
  }, [pdSubdomain, apiToken, globalRoutingKey, fromEmail, selectedTeamIds, universalResponderCfg, ratePerMinute, noteProbability, responderProbabilityMultiplier, autoResolveMinSec, autoResolveMaxSec, severityWeights, includeMap, selectedEPIds]);

  const apiHeaders = React.useMemo(
    () => ({
      Authorization: apiToken ? `Token token=${apiToken.trim()}` : undefined,
      Accept: "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json",
      ...(fromEmail ? { From: fromEmail.trim() } : {}),
    }),
    [apiToken, fromEmail]
  );

  const logMsg = (msg, type = "info") => {
    const ts = new Date().toLocaleTimeString();
    setLog((l) => [{ ts, type, msg }, ...l].slice(0, 800));
    console.log(`[${ts}] ${type.toUpperCase()}: ${msg}`);
  };

  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randChoiceWeighted(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((a, [, w]) => a + Number(w || 0), 0) || 1;
    let r = Math.random() * total;
    for (const [k, w] of entries) { r -= Number(w || 0); if (r <= 0) return k; }
    return entries[entries.length - 1][0];
  }
  function randomSummary(serviceName) {
    const verbs = ["Spike","Timeout","Error","Degradation","Saturation","Anomaly","Failure","High latency"];
    const comps = ["DB","Cache","API","Queue","Worker","Gateway","Search","Billing"];
    return `${randomFrom(verbs)} in ${randomFrom(comps)} for ${serviceName}`;
  }
  function randomSource() { const hosts = ["web-01","web-02","api-01","worker-05","edge-03","cron-02","db-01"]; return randomFrom(hosts) + ".corp"; }
  function randomNote() {
    const notes = [
      "Investigating logs","Metrics look elevated","Rolling restart applied","Suspect recent deploy","Engaging on-call peer","Mitigation in progress","Scaling up replicas","Clearing stuck queue","Awaiting confirmation from DB team",
    ];
    return randomFrom(notes);
  }
  function uid(prefix = "id") { return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`; }

  // ---------- Load Teams ----------
  async function fetchAllTeams() {
    if (!apiToken) { logMsg("Provide a REST API token to load teams", "warn"); return; }
    setIsLoadingTeams(true);
    try {
      const out = []; let offset = 0; const limit = 100; let more = true;
      while (more) {
        const url = new URL("https://api.pagerduty.com/teams");
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        const res = await fetch(url.toString(), { headers: apiHeaders, mode: "cors" });
        const data = await res.json(); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
        const batch = (data?.teams || []).map((t) => ({ id: t.id, name: t.name, html_url: t.html_url }));
        out.push(...batch);
        more = Boolean(data?.more); offset += data?.limit || batch.length || 0;
      }
      out.sort((a, b) => a.name.localeCompare(b.name)); setTeams(out);
      logMsg(`Loaded ${out.length} teams`);
    } catch (e) { logMsg(`Failed to load teams: ${e.message || e}`, "error"); }
    finally { setIsLoadingTeams(false); }
  }

  // ---------- Load Services (optionally filtered by selected teams) ----------
  async function fetchAllServices() {
    if (!apiToken) { logMsg("Provide a REST API token to load services", "warn"); return; }
    setIsLoadingServices(true);
    try {
      const out = []; let offset = 0; const limit = 100; let more = true;
      while (more) {
        const url = new URL("https://api.pagerduty.com/services");
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        url.searchParams.append("include[]", "teams");
        selectedTeamIds.forEach((id) => url.searchParams.append("team_ids[]", id));
        const res = await fetch(url.toString(), { headers: apiHeaders, mode: "cors" });
        const data = await res.json(); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
        const batch = (data?.services || []).map((s) => ({
          id: s.id,
          name: s.name,
          html_url: s.html_url,
          include: includeMap[s.id] ?? false, // persist selection
          teams: (s.teams || []).map((t) => ({ id: t.id, name: t.name })),
        }));
        out.push(...batch);
        more = Boolean(data?.more); offset += data?.limit || batch.length || 0;
      }
      out.sort((a, b) => a.name.localeCompare(b.name)); setServices(out);
      logMsg(`Loaded ${out.length} services${selectedTeamIds.length ? ` (filtered by ${selectedTeamIds.length} team(s))` : ''}`);
    } catch (e) { logMsg(`Failed to load services: ${e.message || e}`, "error"); }
    finally { setIsLoadingServices(false); }
  }

  // ---------- Load Escalation Policies ----------
  async function fetchAllEPs() {
    if (!apiToken) { logMsg("Provide a REST API token to load escalation policies", "warn"); return; }
    setIsLoadingEPs(true);
    try {
      const out = []; let offset = 0; const limit = 100; let more = true;
      while (more) {
        const url = new URL("https://api.pagerduty.com/escalation_policies");
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        url.searchParams.append("include[]", "teams");
        selectedTeamIds.forEach((id) => url.searchParams.append("team_ids[]", id));
        const res = await fetch(url.toString(), { headers: apiHeaders, mode: "cors" });
        const data = await res.json(); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
        const batch = (data?.escalation_policies || []).map((ep) => ({
          id: ep.id,
          name: ep.name,
          html_url: ep.html_url,
          num_levels: Array.isArray(ep.escalation_rules) ? ep.escalation_rules.length : undefined,
          teams: (ep.teams || []).map((t) => ({ id: t.id, name: t.name })),
        }));
        out.push(...batch);
        more = Boolean(data?.more); offset += data?.limit || batch.length || 0;
      }
      out.sort((a, b) => a.name.localeCompare(b.name)); setEscalationPolicies(out);
      logMsg(`Loaded ${out.length} escalation policies${selectedTeamIds.length ? ` (filtered by ${selectedTeamIds.length} team(s))` : ''}`);
    } catch (e) { logMsg(`Failed to load escalation policies: ${e.message || e}`, "error"); }
    finally { setIsLoadingEPs(false); }
  }

  function toggleEP(id, checked) {
    setSelectedEPIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      return prev.filter((x) => x !== id);
    });
  }
  function selectAllEPs(include) {
    if (include) setSelectedEPIds(escalationPolicies.map((r) => r.id));
    else setSelectedEPIds([]);
  }

  function updateServiceInclude(idx, include) {
    setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, include } : s)));
    setIncludeMap((m) => ({ ...m, [services[idx].id]: include }));
  }
  function selectAllServices(include) {
    setServices((prev) => prev.map((s) => ({ ...s, include })));
    setIncludeMap((m) => { const copy = { ...m }; services.forEach((s) => { copy[s.id] = include; }); return copy; });
  }

  // ---------- Events/Incidents ----------
  async function triggerIncidentForService(svc) {
    if (!globalRoutingKey) { logMsg("Global Routing Key required for Events API", "warn"); return null; }
    const dedupKey = uid("dk");
    const severity = randChoiceWeighted(severityWeights);
    const body = {
      routing_key: globalRoutingKey.trim(), event_action: "trigger", dedup_key: dedupKey,
      payload: {
        summary: randomSummary(svc.name), source: randomSource(), severity,
        component: "simulator", group: svc.name, class: "demo",
        custom_details: { service_name: svc.name, simulator: "PagerDuty Noise Simulator", seed: dedupKey, severity },
      },
      client: "PD Noise Simulator", client_url: "https://example.local/simulator",
    };
    try {
      const res = await fetch("https://events.pagerduty.com/v2/enqueue", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), mode: "cors" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Events API error: ${res.status} ${data?.message || res.statusText}`);
      const cfg = universalResponderCfg;
      const now = Date.now();
      const isCrit = severity === 'critical';
      const win = isCrit ? cfg.first.critical : cfg.first.nonCritical;
      const firstResponderDelay = (win.minSec + Math.random() * Math.max(0, win.maxSec - win.minSec)) * 1000;
      const ackDelay = (30 + Math.random() * (300 - 30)) * 1000; // 30s to 5m
      // Auto-resolve time window
      const resolveDelay = (Math.min(autoResolveMinSec, autoResolveMaxSec) + Math.random() * Math.abs(autoResolveMaxSec - autoResolveMinSec)) * 1000;
      logMsg(`Triggered incident for ${svc.name} (severity=${severity}) dk=${dedupKey}`);
      const record = {
        dedupKey, serviceId: svc.id, serviceName: svc.name,
        startedAt: now,
        incidentId: null, mapAttempts: 0, nextEvalAt: now + 60_000,
        ackAt: now + ackDelay, acked: false, firstResponderAt: now + firstResponderDelay,
        responderRequested: false, severity,
        resolveAt: now + resolveDelay,
      };
      setActive((a) => [record, ...a]);
      // First mapping attempt after a short delay
      setTimeout(() => resolveIncidentIdForDedupKey(record, true).catch((e) => logMsg(e.message, "warn")), 4000);
      return record;
    } catch (e) { logMsg(e.message || String(e), "error"); return null; }
  }

  // ---------- Scheduler: Poisson process for triggering incidents ----------
  const scheduleNextFire = React.useCallback(() => {
    clearTimeout(fireTimerRef.current);
    if (!isRunning) return;
    const rpm = Math.max(0, Number(ratePerMinute) || 0);
    if (rpm <= 0) return; // no incident generation
    const lambdaPerSec = rpm / 60; // events per second
    const u = Math.random();
    const interArrivalSec = -Math.log(1 - u) / Math.max(lambdaPerSec, 1e-9); // exponential
    const delayMs = Math.max(250, interArrivalSec * 1000); // clamp tiny delays

    fireTimerRef.current = setTimeout(async () => {
      if (!isRunning) return;
      const targets = services.filter((s) => s.include);
      if (targets.length === 0) {
        logMsg("No included services to target", "warn");
      } else {
        const svc = randomFrom(targets);
        await triggerIncidentForService(svc);
      }
      // Schedule next regardless
      scheduleNextFire();
    }, delayMs);
  }, [isRunning, ratePerMinute, services]);

  // Reschedule fire timer whenever rpm/services change while running
  React.useEffect(() => { if (isRunning) scheduleNextFire(); return () => clearTimeout(fireTimerRef.current); }, [isRunning, scheduleNextFire]);

  // ---------- Periodic evaluations ticker (1s) ----------
  React.useEffect(() => {
    if (!isRunning) return;
    let stop = false;
    const tick = () => {
      if (stop) return;
      setActive((a) => {
        a.forEach((rec) => {
          evaluatePeriodicActions(rec);
        });
        return a;
      });
      evalTimerRef.current = setTimeout(tick, 1000);
    };
    tick();
    return () => { stop = true; clearTimeout(evalTimerRef.current); };
  }, [isRunning, noteProbability, responderProbabilityMultiplier, services, apiToken, fromEmail, globalRoutingKey, universalResponderCfg, selectedEPIds, autoResolveMinSec, autoResolveMaxSec]);

  // ---------- Mapping + actions helpers ----------
  async function resolveIncidentIdForDedupKey(rec, fromTimer = false) {
    if (!apiToken) throw new Error("API token required to map incident ID");
    const MAX_TOTAL_ATTEMPTS = 3; // reduced
    const RETRY_DELAY_MS = 15000; // 15s
    const attemptNum = (rec.mapAttempts || 0) + 1;
    setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, mapAttempts: attemptNum } : x)));

    const sinceISO = new Date(rec.startedAt - 15 * 60 * 1000).toISOString();
    const statuses = ["triggered", "acknowledged"];
    async function search(url) {
      url.searchParams.set("limit", "100"); statuses.forEach((s) => url.searchParams.append("statuses[]", s));
      url.searchParams.set("since", sinceISO); url.searchParams.set("sort_by", "created_at:desc");
      const res = await fetch(url.toString(), { headers: apiHeaders, mode: "cors" });
      const data = await res.json(); if (!res.ok) throw new Error(`Incidents lookup failed: ${res.status} ${data?.error?.message || res.statusText}`);
      return data?.incidents || [];
    }

    try {
      // Try exact match scoped to service first
      const byServiceUrl = new URL("https://api.pagerduty.com/incidents");
      if (rec.serviceId) byServiceUrl.searchParams.append("service_ids[]", rec.serviceId);
      const incs = await search(byServiceUrl);
      const exact = incs.find((i) => i?.incident_key === rec.dedupKey);
      if (exact?.id) { setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, incidentId: exact.id } : x))); if (fromTimer) logMsg(`Mapped (exact) ${rec.dedupKey} -> ${exact.id}`); return exact.id; }
    } catch (e) { logMsg(`Exact mapping lookup error: ${e.message}`, "warn"); }

    try {
      // Try global exact match
      const globalUrl = new URL("https://api.pagerduty.com/incidents");
      const incs = await search(globalUrl);
      const exactGlobal = incs.find((i) => i?.incident_key === rec.dedupKey);
      if (exactGlobal?.id) { setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, incidentId: exactGlobal.id } : x))); if (fromTimer) logMsg(`Mapped (global exact) ${rec.dedupKey} -> ${exactGlobal.id}`); return exactGlobal.id; }
    } catch (e) { logMsg(`Global exact lookup error: ${e.message}`, "warn"); }

    try {
      // Heuristic: recent on same service
      const byServiceRecentUrl = new URL("https://api.pagerduty.com/incidents");
      if (rec.serviceId) byServiceRecentUrl.searchParams.append("service_ids[]", rec.serviceId);
      const incs = await search(byServiceRecentUrl);
      const threshold = new Date(rec.startedAt - 2 * 60 * 1000);
      const candidate = incs.find((i) => new Date(i.created_at) >= threshold);
      if (candidate?.id) { setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, incidentId: candidate.id } : x))); if (fromTimer) logMsg(`Mapped (heuristic recent) ${rec.dedupKey} -> ${candidate.id} on ${rec.serviceName}`); return candidate.id; }
    } catch (e) { logMsg(`Heuristic mapping error: ${e.message}`, "warn"); }

    const nextAttempt = (rec.mapAttempts || 0) + 1;
    if (nextAttempt <= MAX_TOTAL_ATTEMPTS) {
      logMsg(`Incident not found yet for dedup_key ${rec.dedupKey}; retry ${nextAttempt}/${MAX_TOTAL_ATTEMPTS} in 15s`, "warn");
      setTimeout(() => resolveIncidentIdForDedupKey({ ...rec, mapAttempts: nextAttempt }, true).catch(() => {}), RETRY_DELAY_MS);
    } else {
      logMsg(`Could not map incident for ${rec.dedupKey} after ${MAX_TOTAL_ATTEMPTS} attempts. Assuming grouped/suppressed and removing from simulation.`, "warn");
      setActive((a) => a.filter((x) => x.dedupKey !== rec.dedupKey));
    }
    throw new Error(`Incident not found yet for dedup_key ${rec.dedupKey}; will retry or drop`);
  }

  async function acknowledgeIncident(rec) {
    try {
      const body = { routing_key: globalRoutingKey.trim(), event_action: "acknowledge", dedup_key: rec.dedupKey };
      const res = await fetch("https://events.pagerduty.com/v2/enqueue", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), mode: "cors" });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || res.statusText);
      setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, acked: true } : x)));
      logMsg(`Acknowledged dk=${rec.dedupKey} (${rec.serviceName})`);
    } catch (e) { logMsg(`Acknowledge failed for dk=${rec.dedupKey}: ${e.message}`, "warn"); }
  }

  async function addNote(rec, content) {
    if (!apiToken || !fromEmail) { logMsg("API token and From email required to add notes", "warn"); return; }
    if (!rec.incidentId) { logMsg(`Cannot add note yet; mapping pending for ${rec.dedupKey}`, "warn"); return; }
    const id = rec.incidentId;
    try {
      const res = await fetch(`https://api.pagerduty.com/incidents/${id}/notes`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ note: { content } }), mode: "cors" });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
      logMsg(`Added note to ${id}: ${content}`);
    } catch (e) { logMsg(`Note add failed: ${e.message}`, "error"); }
  }

  async function addResponder(rec) {
    if (!apiToken || !fromEmail) { logMsg("API token and From email required to add responders", "warn"); return; }
    if (!rec.incidentId) { logMsg(`Cannot add responder yet; mapping pending for ${rec.dedupKey}`, "warn"); return; }
    const id = rec.incidentId;
    const ids = selectedEPIds;
    if (!ids || ids.length === 0) { logMsg("No escalation policies selected. Load EPs and choose at least one.", "warn"); return; }
    const targetId = randomFrom(ids);
    const body = { responder_request: { message: "Auto-simulated responder request via EP", responder_request_targets: [ { responder_request_target: { id: targetId, type: "escalation_policy_reference" } } ] } };
    try {
      const res = await fetch(`https://api.pagerduty.com/incidents/${id}/responder_requests`, { method: "POST", headers: apiHeaders, body: JSON.stringify(body), mode: "cors" });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
      logMsg(`Requested responder via EP ${targetId} on ${id}`);
    } catch (e) { logMsg(`Responder request failed: ${e.message}`, "error"); }
  }

  async function resolveIncident(rec) {
    try {
      const body = { routing_key: globalRoutingKey.trim(), event_action: "resolve", dedup_key: rec.dedupKey };
      const res = await fetch("https://events.pagerduty.com/v2/enqueue", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), mode: "cors" });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || res.statusText);
      logMsg(`Resolved dk=${rec.dedupKey} (${rec.serviceName})`);
      setActive((a) => a.filter((x) => x.dedupKey !== rec.dedupKey));
    } catch (e) { logMsg(`Resolve failed for dk=${rec.dedupKey}: ${e.message}`, "error"); }
  }

  function evaluatePeriodicActions(rec) {
    const now = Date.now();
    // Per-60s evaluation
    if (rec.nextEvalAt && now >= rec.nextEvalAt) {
      if (Math.random() < noteProbability) { addNote(rec, randomNote()); }
      // Responder per-tick probability based on severity
      const cfg = universalResponderCfg;
      const baseProb = (rec.severity === 'critical') ? cfg.prob.critical : cfg.prob.nonCritical;
      const prob = Math.max(0, Math.min(1, baseProb * responderProbabilityMultiplier));
      if (Math.random() < prob) { addResponder(rec); }
      setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, nextEvalAt: now + 60_000 } : x)));
    }
    // Auto-ack
    if (!rec.acked && rec.ackAt && now >= rec.ackAt) { acknowledgeIncident(rec); }
    // One-time first-responder window based on severity
    if (!rec.responderRequested && rec.firstResponderAt && now >= rec.firstResponderAt) {
      const cfg = universalResponderCfg;
      const baseProb = (rec.severity === 'critical') ? cfg.prob.critical : cfg.prob.nonCritical;
      const prob = Math.max(0, Math.min(1, baseProb * responderProbabilityMultiplier));
      if (Math.random() < prob) { addResponder(rec); }
      setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, responderRequested: true } : x)));
    }
    // Auto-resolve
    if (rec.resolveAt && now >= rec.resolveAt) {
      resolveIncident(rec);
    }
  }

  function start() {
    if (!globalRoutingKey) return logMsg("Provide the Global Routing Key", "warn");
    if (!apiToken) logMsg("Tip: Provide a REST API token + From email to enable notes/responders & ID mapping", "warn");
    if (services.length === 0) { logMsg("No services loaded. Attempting to load now...", "warn"); fetchAllServices().then(() => setIsRunning(true)); }
    else { if (!services.some((s) => s.include)) return logMsg("Include at least one service", "warn"); setIsRunning(true); logMsg("Simulation started"); }
  }
  function stop() { setIsRunning(false); clearTimeout(fireTimerRef.current); clearTimeout(evalTimerRef.current); logMsg("Simulation paused"); }
  function clearLog() { setLog([]); }
  function clearActive() { setActive([]); }

  const activeCount = active.length;

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-indigo-600 text-white p-4 shadow">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">PagerDuty Incident Noise Simulator</h1>
          <div className="space-x-2">
            {!isRunning ? (
              <button onClick={start} className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded text-white">Start</button>
            ) : (
              <button onClick={stop} className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded text-white">Pause</button>
            )}
            <button onClick={clearLog} className="bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded text-white">Clear Log</button>
            <button onClick={clearActive} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-gray-900">Clear Active</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Organization & Credentials</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">PD Subdomain</label>
              <input value={pdSubdomain} onChange={(e) => setPdSubdomain(e.target.value)} placeholder="your-domain" className="w-full border rounded px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">Links: https://{pdSubdomain || 'your-domain'}.pagerduty.com</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">REST API Token</label>
              <input value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="xYz123..." className="w-full border rounded px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">Stored in your browser's localStorage</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Global Routing Key (Events v2)</label>
              <input value={globalRoutingKey} onChange={(e) => setGlobalRoutingKey(e.target.value)} placeholder="ROUTING_KEY" className="w-full border rounded px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">Sent via Global Event Orchestration</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">From Email</label>
              <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="you@company.com" className="w-full border rounded px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">Required for notes/responders endpoints</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button disabled={isLoadingTeams} onClick={fetchAllTeams} className={`px-3 py-1.5 rounded text-white ${isLoadingTeams ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isLoadingTeams ? 'Loading Teams…' : 'Load Teams'}
            </button>
            <button disabled={isLoadingServices} onClick={fetchAllServices} className={`px-3 py-1.5 rounded text-white ${isLoadingServices ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isLoadingServices ? 'Loading Services…' : 'Load Services'}
            </button>
          </div>
        </section>

        <section className="bg-white shadow rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Teams ({teams.length})</h2>
          </div>
          {teams.length === 0 ? (
            <p className="text-sm text-gray-500">Load teams to filter Services and Escalation Policies.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {teams.map((t) => {
                  const checked = selectedTeamIds.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        setSelectedTeamIds((prev) => {
                          if (e.target.checked) return [...new Set([...prev, t.id])];
                          return prev.filter((id) => id !== t.id);
                        });
                      }} />
                      <span>{t.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => { fetchAllServices(); fetchAllEPs(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded">Apply Team Filter (Reload Services & EPs)</button>
          </div>
        </section>

        <section className="bg-white shadow rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Services ({services.length})</h2>
            <div className="space-x-2">
              <button onClick={() => selectAllServices(true)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">Select All</button>
              <button onClick={() => selectAllServices(false)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">Deselect All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Include</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Teams</th>
                  <th className="py-2 pr-4">Service ID</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-4"><input type="checkbox" checked={!!s.include} onChange={(e) => updateServiceInclude(i, e.target.checked)} /></td>
                    <td className="py-2 pr-4">{s.html_url ? (<a href={s.html_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{s.name}</a>) : (<span>{s.name}</span>)}</td>
                    <td className="py-2 pr-4 text-xs text-gray-600">{(s.teams || []).map((t) => t.name).join(', ') || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{s.id}</td>
                    <td className="py-2 pr-4"><button onClick={() => triggerIncidentForService(s)} className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Trigger</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {services.length === 0 && (<p className="text-sm text-gray-500 mt-2">No services loaded yet. Click "Load Services" above.</p>)}
          </div>
        </section>

        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Escalation Policies</h2>
          <div className="flex items-center gap-2 mb-2">
            <button disabled={isLoadingEPs} onClick={fetchAllEPs} className={`px-3 py-1.5 rounded text-white ${isLoadingEPs ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isLoadingEPs ? 'Loading Escalation Policies…' : 'Load Escalation Policies'}
            </button>
            <button onClick={() => selectAllEPs(true)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">Select All</button>
            <button onClick={() => selectAllEPs(false)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">Deselect All</button>
            <span className="text-sm text-gray-600">Selected: {selectedEPIds.length}</span>
          </div>
          {escalationPolicies.length === 0 ? (
            <p className="text-sm text-gray-500">No escalation policies loaded. Click "Load Escalation Policies" to fetch from your PD domain.</p>
          ) : (
            <div className="max-h-64 overflow-auto border rounded p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {escalationPolicies.map((ep) => (
                  <label key={ep.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEPIds.includes(ep.id)}
                      onChange={(e) => toggleEP(ep.id, e.target.checked)}
                    />
                    <span>
                      {ep.html_url ? (<a href={ep.html_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{ep.name}</a>) : ep.name}
                      <span className="text-gray-500">{typeof ep.num_levels === 'number' ? ` • ${ep.num_levels} level(s)` : ''}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">Responder requests will randomly pick an Escalation Policy you selected.</p>
        </section>

        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Simulation Settings</h2>
          <div className="grid grid-cols-1 md-grid-cols-3 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Incidents per minute</label>
              <input type="number" min={0} value={ratePerMinute} onChange={(e) => setRatePerMinute(Number(e.target.value))} className="w-full border rounded px-3 py-2"/>
              <p className="text-xs text-gray-500 mt-1">Average over time (Poisson). 6 = ~6 total incidents/minute.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Note probability per 60s tick (0-1)</label>
              <input type="number" min={0} max={1} step={0.05} value={noteProbability} onChange={(e) => setNoteProbability(Number(e.target.value))} className="w-full border rounded px-3 py-2"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Responder probability multiplier</label>
              <input type="number" min={0} max={2} step={0.05} value={responderProbabilityMultiplier} onChange={(e) => setResponderProbabilityMultiplier(Number(e.target.value))} className="w-full border rounded px-3 py-2"/>
              <p className="text-xs text-gray-500 mt-1">Scales global per-severity probabilities</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Auto-resolve min (sec)</label>
              <input type="number" min={10} value={autoResolveMinSec} onChange={(e) => setAutoResolveMinSec(Number(e.target.value))} className="w-full border rounded px-3 py-2"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Auto-resolve max (sec)</label>
              <input type="number" min={10} value={autoResolveMaxSec} onChange={(e) => setAutoResolveMaxSec(Number(e.target.value))} className="w-full border rounded px-3 py-2"/>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity weights</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(severityWeights).map((k) => (
                  <div key={k} className="flex items-center space-x-1">
                    <span className="text-xs w-14 capitalize">{k}</span>
                    <input type="number" min={0} step={0.05} value={severityWeights[k]} onChange={(e) => setSeverityWeights({ ...severityWeights, [k]: Number(e.target.value) })} className="w-20 border rounded px-2 py-1"/>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Universal Responder Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Critical</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Probability
                  <input type="number" min={0} max={1} step={0.05} value={universalResponderCfg.prob.critical}
                    onChange={(e) => setUniversalResponderCfg((p) => ({ ...p, prob: { ...p.prob, critical: Number(e.target.value) } }))}
                    className="w-full border rounded px-2 py-1" />
                </label>
                <label className="text-sm">First min (sec)
                  <input type="number" min={0} value={universalResponderCfg.first.critical.minSec}
                    onChange={(e) => setUniversalResponderCfg((p) => ({ ...p, first: { ...p.first, critical: { ...p.first.critical, minSec: Number(e.target.value) } } }))}
                    className="w-full border rounded px-2 py-1" />
                </label>
                <label className="text-sm">First max (sec)
                  <input type="number" min={0} value={universalResponderCfg.first.critical.maxSec}
                    onChange={(e) => setUniversalResponderCfg((p) => ({ ...p, first: { ...p.first, critical: { ...p.first.critical, maxSec: Number(e.target.value) } } }))}
                    className="w-full border rounded px-2 py-1" />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Non-Critical</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">Probability
                  <input type="number" min={0} max={1} step={0.05} value={universalResponderCfg.prob.nonCritical}
                    onChange={(e) => setUniversalResponderCfg((p) => ({ ...p, prob: { ...p.prob, nonCritical: Number(e.target.value) } }))}
                    className="w-full border rounded px-2 py-1" />
                </label>
                <label className="text-sm">First min (sec)
                  <input type="number" min={0} value={universalResponderCfg.first.nonCritical.minSec}
                    onChange={(e) => setUniversalResponderCfg((p) => ({ ...p, first: { ...p.first, nonCritical: { ...p.first.nonCritical, minSec: Number(e.target.value) } } }))}
                    className="w-full border rounded px-2 py-1" />
                </label>
                <label className="text-sm">First max (sec)
                  <input type="number" min={0} value={universalResponderCfg.first.nonCritical.maxSec}
                    onChange={(e) => setUniversalResponderCfg((p) => ({ ...p, first: { ...p.first, nonCritical: { ...p.first.nonCritical, maxSec: Number(e.target.value) } } }))}
                    className="w-full border rounded px-2 py-1" />
                </label>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Applies to all services. Responder requests use your selected Escalation Policies.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white shadow rounded p-4">
            <h2 className="text-lg font-semibold mb-3">Active Simulated Incidents ({activeCount})</h2>
            <div className="max-h-96 overflow-auto">
              {active.length === 0 ? (<p className="text-sm text-gray-500">None</p>) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Service</th>
                      <th className="py-2 pr-4">Severity</th>
                      <th className="py-2 pr-4">Dedup Key</th>
                      <th className="py-2 pr-4">Incident ID</th>
                      <th className="py-2 pr-4">Ack</th>
                      <th className="py-2 pr-4">Attempts</th>
                      <th className="py-2 pr-4">Age</th>
                      <th className="py-2 pr-4">Next Eval</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((rec) => (
                      <tr key={rec.dedupKey} className="border-b last:border-0">
                        <td className="py-2 pr-4">{rec.serviceName}</td>
                        <td className="py-2 pr-4 capitalize">{rec.severity}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{rec.dedupKey}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{rec.incidentId || <span className="text-gray-400">(mapping...)</span>}</td>
                        <td className="py-2 pr-4">{rec.acked ? 'Yes' : 'No'}</td>
                        <td className="py-2 pr-4">{rec.mapAttempts || 0}</td>
                        <td className="py-2 pr-4">{Math.floor((Date.now() - rec.startedAt) / 1000)}s</td>
                        <td className="py-2 pr-4">{rec.nextEvalAt ? Math.max(0, Math.ceil((rec.nextEvalAt - Date.now()) / 1000)) + 's' : '—'}</td>
                        <td className="py-2 pr-4 space-x-2">
                          <button onClick={() => addNote(rec, randomNote())} className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded">Add Note</button>
                          <button onClick={() => addResponder(rec)} className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded">Add Responder</button>
                          <button onClick={() => acknowledgeIncident(rec)} className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded">Ack</button>
                          <button onClick={() => resolveIncident(rec)} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded">Resolve</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded p-4">
            <h2 className="text-lg font-semibold mb-3">Log</h2>
            <div className="max-h-96 overflow-auto space-y-1 font-mono text-xs">
              {log.map((l, idx) => (
                <div key={idx} className={ l.type === "error" ? "text-red-600" : l.type === "warn" ? "text-yellow-700" : "text-gray-800" }>
                  [{l.ts}] {l.type.toUpperCase()}: {l.msg}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Notes for Global Event Orchestration</h2>
          <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
            <li>Incidents are generated as a Poisson process at the configured average rate. For example, 6 ≈ 6 total incidents per minute on average.</li>
            <li>Events use the single Global Routing Key you provide; acknowledge/resolve also go through Events API using the same dedup_key.</li>
            <li>Dynamic routing should match on <span className="font-mono">event.payload.custom_details.service_name</span> exactly to the PD Service Name.</li>
            <li>Every 60s per active incident, the simulator evaluates adding a note and requesting responders based on global per-severity probabilities.</li>
            <li>Auto-ack happens at a random time between 30 seconds and 5 minutes after trigger. Auto-resolve happens in your configured window.</li>
            <li>Incident ID mapping retries reduced: up to 3 attempts every 15s; if not found, we assume it was grouped/suppressed and remove it from the simulation.</li>
            <li>Responder requests now target Escalation Policies, not individual users. Selection persists in localStorage (v7).</li>
          </ul>
        </section>
      </main>
    </div>
  );
}