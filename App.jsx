const HIDDEN_TEAM_PREFIXES = ["NOC - ", "SRE - "];
const NO_TEAM_ID = "__no_team__";
const NO_TEAM_NAME = "Unassigned (No Team)";
const TREND_WINDOW_MS = 15 * 60 * 1000;

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
  const [requesterUser, setRequesterUser] = React.useState({ email: null, id: null });

  // ---------- Teams and Services fetched from PD ----------
  const [teams, setTeams] = React.useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState([]);
  const [services, setServices] = React.useState([]);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(false);
  const [isLoadingServices, setIsLoadingServices] = React.useState(false);

  // Persisted include-by-service-id map
  const [includeMap, setIncludeMap] = React.useState({});
  const [collapsedTeams, setCollapsedTeams] = React.useState({});

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
  const [severityWeights, setSeverityWeights] = React.useState({ info: 0.2, warning: 0.4, error: 0.25, critical: 0.15 });

  const [isRunning, setIsRunning] = React.useState(false);
  const [log, setLog] = React.useState([]);
  // active rec: { dedupKey, serviceId, serviceName, startedAt, incidentId, mapAttempts, nextEvalAt, ackAt, acked, firstResponderAt, responderRequested, severity }
  const [active, setActive] = React.useState([]);
  const [activePage, setActivePage] = React.useState('configure');
  const [monitorSeverityFilter, setMonitorSeverityFilter] = React.useState('all');
  const [monitorAckFilter, setMonitorAckFilter] = React.useState('all');
  const [monitorMappingFilter, setMonitorMappingFilter] = React.useState('all');
  const [monitorSort, setMonitorSort] = React.useState({ key: 'startedAt', direction: 'desc' });
  const [selectedIncident, setSelectedIncident] = React.useState(null);
  const [monitorTrend, setMonitorTrend] = React.useState([]);
  const [logFilter, setLogFilter] = React.useState('all');
  const [logAutoStick, setLogAutoStick] = React.useState(true);

  // Timers/refs for schedulers
  const fireTimerRef = React.useRef(null);
  const evalTimerRef = React.useRef(null);
  const logContainerRef = React.useRef(null);
  const latestActiveRef = React.useRef(0);

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
    if (st.activePage && (st.activePage === 'configure' || st.activePage === 'monitor')) setActivePage(st.activePage);
  }, []);

  // ---------- Persist settings whenever they change ----------
  React.useEffect(() => {
    const st = {
      pdSubdomain, apiToken, globalRoutingKey, fromEmail,
      selectedTeamIds, universalResponderCfg,
      ratePerMinute, noteProbability, responderProbabilityMultiplier,
      autoResolveMinSec, autoResolveMaxSec, severityWeights, includeMap,
      selectedEPIds,
      activePage,
    };
    saveLS(st);
  }, [pdSubdomain, apiToken, globalRoutingKey, fromEmail, selectedTeamIds, universalResponderCfg, ratePerMinute, noteProbability, responderProbabilityMultiplier, autoResolveMinSec, autoResolveMaxSec, severityWeights, includeMap, selectedEPIds, activePage]);

  React.useEffect(() => {
    setRequesterUser({ email: null, id: null });
  }, [fromEmail]);

  React.useEffect(() => {
    if (!selectedIncident) return;
    const match = active.find((rec) => rec.dedupKey === selectedIncident.dedupKey);
    if (!match) {
      setSelectedIncident(null);
    } else if (match !== selectedIncident) {
      setSelectedIncident(match);
    }
  }, [active, selectedIncident]);

  React.useEffect(() => {
    if (!logAutoStick) return;
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTop = 0;
  }, [log, logFilter, logAutoStick]);

  React.useEffect(() => {
    function capture() {
      const nowTs = Date.now();
      setMonitorTrend((prev) => {
        const windowStart = nowTs - TREND_WINDOW_MS;
        const trimmed = prev.filter((point) => point.ts >= windowStart);
        return [...trimmed, { ts: nowTs, count: latestActiveRef.current }];
      });
    }
    capture();
    const interval = setInterval(capture, 30_000);
    return () => clearInterval(interval);
  }, []);

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

  async function ensureRequesterId() {
    const email = (fromEmail || "").trim();
    if (!email) {
      logMsg("From email required to request responders", "warn");
      return null;
    }
    if (!apiToken) {
      logMsg("API token required to resolve From email to user", "warn");
      return null;
    }
    if (requesterUser.email === email && requesterUser.id) {
      return requesterUser.id;
    }
    try {
      const url = new URL("/proxy/users", window.location.origin);
      url.searchParams.set("query", email);
      url.searchParams.set("limit", "25");
      const res = await fetch(url.toString(), { headers: apiHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || res.statusText);
      const users = Array.isArray(data?.users) ? data.users : [];
      const match = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
      if (match?.id) {
        setRequesterUser({ email, id: match.id });
        return match.id;
      }
      if (users.length > 0) {
        logMsg(`From email did not exactly match a user. Candidates: ${users.map((u) => u.email).join(", ")}`, "warn");
      } else {
        logMsg(`No PagerDuty user found for email ${email}`, "warn");
      }
    } catch (e) {
      logMsg(`Failed to resolve From email to user: ${e.message || e}`, "error");
    }
    return null;
  }
  function uid(prefix = "id") { return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`; }

  // ---------- Load Teams ----------
  async function fetchAllTeams() {
    if (!apiToken) { logMsg("Provide a REST API token to load teams", "warn"); return; }
    setIsLoadingTeams(true);
    try {
      const out = []; let offset = 0; const limit = 100; let more = true;
      while (more) {
        const url = new URL("/proxy/teams", window.location.origin);
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        const res = await fetch(url.toString(), { headers: apiHeaders });
        const data = await res.json(); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
        const batch = (data?.teams || []).map((t) => ({ id: t.id, name: t.name, html_url: t.html_url }));
        out.push(...batch);
        more = Boolean(data?.more); offset += data?.limit || batch.length || 0;
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      const visibleTeams = out.filter((team) => !HIDDEN_TEAM_PREFIXES.some((prefix) => team.name?.startsWith(prefix)));
      setTeams(visibleTeams);
      setSelectedTeamIds((prev) => prev.filter((id) => visibleTeams.some((team) => team.id === id)));
      const hiddenCount = out.length - visibleTeams.length;
      logMsg(`Loaded ${visibleTeams.length} teams${hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}`);
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
        const url = new URL("/proxy/services", window.location.origin);
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        url.searchParams.append("include[]", "teams");
        selectedTeamIds.forEach((id) => url.searchParams.append("team_ids[]", id));
        const res = await fetch(url.toString(), { headers: apiHeaders });
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
        const url = new URL("/proxy/escalation_policies", window.location.origin);
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        url.searchParams.append("include[]", "teams");
        selectedTeamIds.forEach((id) => url.searchParams.append("team_ids[]", id));
        const res = await fetch(url.toString(), { headers: apiHeaders });
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

  function updateServiceInclude(serviceId, include) {
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, include } : s)));
    setIncludeMap((m) => ({ ...m, [serviceId]: include }));
  }
  function selectAllServices(include) {
    setServices((prev) => prev.map((s) => ({ ...s, include })));
    setIncludeMap((m) => { const copy = { ...m }; services.forEach((s) => { copy[s.id] = include; }); return copy; });
  }

  const servicesGroupedByTeam = React.useMemo(() => {
    if (!services.length) return [];
    const groups = new Map();
    function ensureGroup(teamId, teamName) {
      if (!groups.has(teamId)) {
        groups.set(teamId, { teamId, teamName, services: [] });
      }
      return groups.get(teamId);
    }
    services.forEach((svc) => {
      const svcTeams = Array.isArray(svc.teams) && svc.teams.length > 0
        ? svc.teams
        : [{ id: NO_TEAM_ID, name: NO_TEAM_NAME }];
      svcTeams.forEach((team) => {
        ensureGroup(team.id, team.name).services.push(svc);
      });
    });
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        services: [...group.services].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [services]);

  const teamServiceIds = React.useMemo(() => {
    const map = {};
    servicesGroupedByTeam.forEach((group) => {
      map[group.teamId] = new Set(group.services.map((svc) => svc.id));
    });
    return map;
  }, [servicesGroupedByTeam]);

  const setTeamServicesInclude = React.useCallback((teamId, include) => {
    const ids = teamServiceIds[teamId];
    if (!ids || ids.size === 0) return;
    setServices((prev) => prev.map((svc) => (ids.has(svc.id) ? { ...svc, include } : svc)));
    setIncludeMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = include; });
      return next;
    });
  }, [teamServiceIds]);

  function isTeamCollapsed(teamId) {
    const value = collapsedTeams[teamId];
    return value === undefined ? true : value;
  }

  function toggleTeamCollapsed(teamId) {
    setCollapsedTeams((prev) => {
      const next = { ...prev };
      const current = prev[teamId];
      const currentlyCollapsed = current === undefined ? true : current;
      next[teamId] = !currentlyCollapsed;
      return next;
    });
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
      const res = await fetch("/proxy/events", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
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
      if (severity === 'info') {
        logMsg(`Info severity suppressed; not tracking incident ${dedupKey}`, "info");
        return null;
      }
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
      const res = await fetch(url.toString(), { headers: apiHeaders });
      const data = await res.json(); if (!res.ok) throw new Error(`Incidents lookup failed: ${res.status} ${data?.error?.message || res.statusText}`);
      return data?.incidents || [];
    }

    try {
      // Try exact match scoped to service first
      const byServiceUrl = new URL("/proxy/incidents", window.location.origin);
      if (rec.serviceId) byServiceUrl.searchParams.append("service_ids[]", rec.serviceId);
      const incs = await search(byServiceUrl);
      const exact = incs.find((i) => i?.incident_key === rec.dedupKey);
      if (exact?.id) { setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, incidentId: exact.id } : x))); if (fromTimer) logMsg(`Mapped (exact) ${rec.dedupKey} -> ${exact.id}`); return exact.id; }
    } catch (e) { logMsg(`Exact mapping lookup error: ${e.message}`, "warn"); }

    try {
      // Try global exact match
      const globalUrl = new URL("/proxy/incidents", window.location.origin);
      const incs = await search(globalUrl);
      const exactGlobal = incs.find((i) => i?.incident_key === rec.dedupKey);
      if (exactGlobal?.id) { setActive((a) => a.map((x) => (x.dedupKey === rec.dedupKey ? { ...x, incidentId: exactGlobal.id } : x))); if (fromTimer) logMsg(`Mapped (global exact) ${rec.dedupKey} -> ${exactGlobal.id}`); return exactGlobal.id; }
    } catch (e) { logMsg(`Global exact lookup error: ${e.message}`, "warn"); }

    try {
      // Heuristic: recent on same service
      const byServiceRecentUrl = new URL("/proxy/incidents", window.location.origin);
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
      const res = await fetch("/proxy/events", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
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
      const res = await fetch(`/proxy/incidents/${id}/notes`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ note: { content } }) });
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
    const validIds = ids.filter((epId) => escalationPolicies.some((ep) => ep.id === epId));
    if (validIds.length === 0) {
      logMsg("Selected escalation policies no longer exist. Refresh escalation policies and reselect.", "warn");
      return;
    }
    const requesterId = await ensureRequesterId();
    if (!requesterId) {
      logMsg("Cannot request responder without resolving requester user ID.", "error");
      return;
    }
    const targetId = randomFrom(validIds);
    const targetEp = escalationPolicies.find((ep) => ep.id === targetId);
    logMsg(`Requesting responder via EP ${targetEp?.name || targetId} (${targetId}) on ${id}`, "info");
    const body = {
      requester_id: requesterId,
      message: "Auto-simulated responder request via EP",
      responder_request_targets: [
        {
          responder_request_target: {
            id: targetId,
            type: "escalation_policy_reference",
          },
        },
      ],
    };
    try {
      const res = await fetch(`/proxy/incidents/${id}/responder_requests`, { method: "POST", headers: apiHeaders, body: JSON.stringify(body) });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
      if (!res.ok) {
        const errors = data?.error?.errors;
        const detail = Array.isArray(errors) && errors.length ? errors.join("; ") : data?.error?.message || text || res.statusText;
        throw new Error(detail ? `${res.status} ${detail}` : res.statusText);
      }
      logMsg(`Requested responder via EP ${targetId} on ${id}`);
    } catch (e) { logMsg(`Responder request failed: ${e.message}`, "error"); }
  }

  async function resolveIncident(rec) {
    try {
      const body = { routing_key: globalRoutingKey.trim(), event_action: "resolve", dedup_key: rec.dedupKey };
      const res = await fetch("/proxy/events", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
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
  function resolveAll() {
    if (active.length === 0) return;
    active.forEach((rec) => resolveIncident(rec));
    logMsg(`Resolve All issued for ${active.length} incident(s)`, "warn");
  }

  const activeCount = active.length;
  React.useEffect(() => {
    latestActiveRef.current = activeCount;
  }, [activeCount]);
  const now = Date.now();
  const ackedCount = React.useMemo(() => active.filter((rec) => rec.acked).length, [active]);
  const unackedCount = activeCount - ackedCount;
  const pendingResponderCount = React.useMemo(() => active.filter((rec) => !rec.responderRequested).length, [active]);
  const stalledMappingCount = React.useMemo(
    () => active.filter((rec) => !rec.incidentId && (rec.mapAttempts || 0) >= 3).length,
    [active]
  );

  const severityRank = React.useMemo(() => ({ critical: 0, error: 1, warning: 2, info: 3 }), []);
  const filteredActive = React.useMemo(() => {
    return active.filter((rec) => {
      if (monitorSeverityFilter === 'critical' && rec.severity !== 'critical') return false;
      if (monitorAckFilter === 'acked' && !rec.acked) return false;
      if (monitorAckFilter === 'unacked' && rec.acked) return false;
      if (monitorMappingFilter === 'unmapped' && rec.incidentId) return false;
      if (monitorMappingFilter === 'stalled') {
        const attempts = rec.mapAttempts || 0;
        if (rec.incidentId || attempts < 3) return false;
      }
      return true;
    });
  }, [active, monitorAckFilter, monitorMappingFilter, monitorSeverityFilter]);

  const sortedActive = React.useMemo(() => {
    const rows = [...filteredActive];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (monitorSort.key) {
        case 'severity':
          cmp = (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
          break;
        case 'age':
          cmp = (a.startedAt || 0) - (b.startedAt || 0);
          break;
        case 'attempts':
          cmp = (a.mapAttempts || 0) - (b.mapAttempts || 0);
          break;
        default:
          cmp = (a.startedAt || 0) - (b.startedAt || 0);
          break;
      }
      if (cmp === 0) {
        cmp = (a.dedupKey || '').localeCompare(b.dedupKey || '');
      }
      return monitorSort.direction === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredActive, monitorSort, severityRank]);

  const isFilterActive = monitorSeverityFilter !== 'all' || monitorAckFilter !== 'all' || monitorMappingFilter !== 'all';
  const latestTrendCount = monitorTrend.length ? monitorTrend[monitorTrend.length - 1].count : 0;
  const trendGraph = React.useMemo(() => {
    const nowTs = Date.now();
    const windowStart = nowTs - TREND_WINDOW_MS;
    const samples = monitorTrend.filter((point) => point.ts >= windowStart);
    if (samples.length === 0) return null;
    const width = 360;
    const height = 160;
    const padding = { top: 12, right: 16, bottom: 28, left: 44 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const counts = samples.map((point) => point.count);
    const maxCount = Math.max(...counts, 1);
    const minCount = Math.min(...counts);
    const sameValue = maxCount === minCount;
    const range = sameValue ? 1 : maxCount - minCount;
    const points = samples
      .sort((a, b) => a.ts - b.ts)
      .map((point) => {
        const x = padding.left + ((point.ts - windowStart) / TREND_WINDOW_MS) * innerWidth;
        const normalized = sameValue ? 0.5 : (point.count - minCount) / range;
        const y = padding.top + (1 - normalized) * innerHeight;
        return { x, y, count: point.count };
      });
    if (!points.length) return null;
    const baselineY = padding.top + innerHeight;
    const pathD = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
    const yTicks = 4;
    const ticks = Array.from({ length: yTicks + 1 }, (_, idx) => {
      const value = sameValue ? minCount : minCount + (range * idx) / yTicks;
      const normalized = sameValue ? 0.5 : (value - minCount) / range;
      const y = padding.top + (1 - normalized) * innerHeight;
      return { y, value: Math.round(value) };
    });
    return {
      width,
      height,
      pathD,
      areaD,
      points,
      ticks,
      padding,
      baselineY,
      xStart: padding.left,
      xEnd: width - padding.right,
    };
  }, [monitorTrend]);
  const severityTone = React.useMemo(() => ({
    critical: 'bg-red-600',
    error: 'bg-orange-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  }), []);
  const toggleSort = React.useCallback((key) => {
    setMonitorSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'severity' ? 'asc' : 'desc' };
    });
  }, []);
  const sortIndicator = React.useCallback((key) => {
    if (monitorSort.key !== key) return '↕';
    return monitorSort.direction === 'asc' ? '▲' : '▼';
  }, [monitorSort]);
  const formatSeconds = React.useCallback((seconds) => {
    const sec = Math.max(0, Math.floor(seconds));
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) {
      const minutes = Math.floor(sec / 60);
      const rem = sec % 60;
      return `${minutes}m${rem ? ` ${rem}s` : ''}`;
    }
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours}h${minutes ? ` ${minutes}m` : ''}`;
  }, []);

  const selectedIncidentLogs = React.useMemo(() => {
    if (!selectedIncident) return [];
    return log.filter((entry) => entry?.msg?.includes?.(selectedIncident.dedupKey)).slice(0, 20);
  }, [log, selectedIncident]);

  const logCounts = React.useMemo(() => {
    let errors = 0; let warns = 0; let infos = 0;
    log.forEach((entry) => {
      if (entry?.type === 'error') errors += 1;
      else if (entry?.type === 'warn') warns += 1;
      else infos += 1;
    });
    return {
      all: log.length,
      error: errors,
      warn: warns,
      info: infos,
    };
  }, [log]);

  const visibleLog = React.useMemo(() => {
    if (logFilter === 'error') return log.filter((entry) => entry.type === 'error');
    if (logFilter === 'warn') return log.filter((entry) => entry.type === 'warn');
    if (logFilter === 'info') return log.filter((entry) => entry.type === 'info');
    return log;
  }, [log, logFilter]);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-indigo-600 text-white p-4 shadow">
        <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold">PagerDuty Incident Noise Simulator</h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <nav className="flex items-center gap-2" aria-label="Primary">
              <button
                type="button"
                onClick={() => setActivePage('configure')}
                aria-current={activePage === 'configure' ? 'page' : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 ${
                  activePage === 'configure' ? 'bg-white/20 text-white' : 'text-indigo-100 hover:bg-indigo-500/40'
                }`}
              >
                Configure
              </button>
              <button
                type="button"
                onClick={() => setActivePage('monitor')}
                aria-current={activePage === 'monitor' ? 'page' : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 ${
                  activePage === 'monitor' ? 'bg-white/20 text-white' : 'text-indigo-100 hover:bg-indigo-500/40'
                }`}
              >
                Monitor
              </button>
            </nav>
            <div className="flex items-center gap-2 sm:ml-auto">
              {!isRunning ? (
                <button onClick={start} className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600">
                  Start
                </button>
              ) : (
                <button onClick={stop} className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600">
                  Pause
                </button>
              )}
              <button onClick={clearLog} className="bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600">
                Clear Log
              </button>
              <button onClick={clearActive} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600">
                Clear Active
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {activePage === 'configure' && (
          <div className="space-y-6">
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
          {services.length === 0 ? (
            <p className="text-sm text-gray-500">No services loaded yet. Click "Load Services" above.</p>
          ) : (
            <div className="space-y-3">
              {servicesGroupedByTeam.map((group) => {
                const isCollapsed = isTeamCollapsed(group.teamId);
                return (
                  <div key={group.teamId} className="border rounded">
                    <div className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-t">
                      <button type="button" onClick={() => toggleTeamCollapsed(group.teamId)} className="flex items-center gap-2 text-left">
                        <span className="font-mono text-xs">{isCollapsed ? '>' : 'v'}</span>
                        <span className="font-semibold">{group.teamName}</span>
                        <span className="text-xs text-gray-600">({group.services.length})</span>
                      </button>
                      <div className="space-x-2">
                        <button onClick={() => setTeamServicesInclude(group.teamId, true)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm">Select Team</button>
                        <button onClick={() => setTeamServicesInclude(group.teamId, false)} className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm">Deselect Team</button>
                      </div>
                    </div>
                    {!isCollapsed && (
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
                            {group.services.map((s) => (
                              <tr key={`${group.teamId}-${s.id}`} className="border-b last:border-0">
                                <td className="py-2 pr-4">
                                  <input type="checkbox" checked={!!s.include} onChange={(e) => updateServiceInclude(s.id, e.target.checked)} />
                                </td>
                                <td className="py-2 pr-4">
                                  {s.html_url ? (
                                    <a href={s.html_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{s.name}</a>
                                  ) : (
                                    <span>{s.name}</span>
                                  )}
                                </td>
                                <td className="py-2 pr-4 text-xs text-gray-600">{(s.teams || []).map((t) => t.name).join(', ') || '—'}</td>
                                <td className="py-2 pr-4 font-mono text-xs">{s.id}</td>
                                <td className="py-2 pr-4">
                                  <button onClick={() => triggerIncidentForService(s)} className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Trigger</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

          </div>
        )}

        {activePage === 'monitor' && (
          <div className="space-y-6">
            <section className="bg-white shadow rounded p-4">
              <h2 className="text-lg font-semibold mb-4">Current Load</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Active</p>
                  <p className="mt-1 text-2xl font-semibold text-indigo-900">{activeCount}</p>
                  <p className="text-xs text-indigo-700">Acked {ackedCount} / {activeCount}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Unacked</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-900">{unackedCount}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Responder Pending</p>
                  <p className="mt-1 text-2xl font-semibold text-blue-900">{pendingResponderCount}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Mapping Stalled</p>
                  <p className="mt-1 text-2xl font-semibold text-rose-900">{stalledMappingCount}</p>
                </div>
              </div>
            </section>

            <section className="bg-white shadow rounded p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">Active Trend (15 minutes)</h2>
                <p className="text-xs text-gray-500">Samples captured every 30 seconds</p>
              </div>
              {trendGraph ? (
                <div className="mt-4">
                  <svg
                    viewBox={`0 0 ${trendGraph.width} ${trendGraph.height}`}
                    className="h-32 w-full"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.35)" />
                        <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                      </linearGradient>
                    </defs>
                    {trendGraph.ticks.map((tick, idx) => (
                      <g key={`tick-${idx}`}>
                        <line
                          x1={trendGraph.xStart}
                          y1={tick.y}
                          x2={trendGraph.xEnd}
                          y2={tick.y}
                          stroke="rgba(15, 118, 110, 0.12)"
                          strokeWidth="1"
                        />
                        <text
                          x={trendGraph.xStart - 8}
                          y={tick.y + 4}
                          fontSize="11"
                          textAnchor="end"
                          fill="#0f766e"
                        >
                          {tick.value}
                        </text>
                      </g>
                    ))}
                    <line
                      x1={trendGraph.xStart}
                      y1={trendGraph.baselineY}
                      x2={trendGraph.xEnd}
                      y2={trendGraph.baselineY}
                      stroke="rgba(15, 118, 110, 0.2)"
                      strokeWidth="1.25"
                    />
                    <path d={trendGraph.areaD} fill="url(#trendAreaGradient)" />
                    <path
                      d={trendGraph.pathD}
                      fill="none"
                      stroke="#047857"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {trendGraph.points.length > 0 && (
                      <circle
                        cx={trendGraph.points[trendGraph.points.length - 1].x}
                        cy={trendGraph.points[trendGraph.points.length - 1].y}
                        r="4"
                        fill="#047857"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}
                  </svg>
                  <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    <span>15m ago</span>
                    <span>Now</span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">Collecting samples… check back shortly.</p>
              )}
              <p className="mt-2 text-xs text-gray-500">Latest sample: {latestTrendCount} active incidents</p>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-4 rounded bg-white p-4 shadow">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h2 className="text-lg font-semibold">
                    Active Simulated Incidents ({sortedActive.length}{sortedActive.length !== activeCount ? ` / ${activeCount}` : ''})
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs font-semibold uppercase text-gray-500">
                      Severity
                      <select
                        value={monitorSeverityFilter}
                        onChange={(e) => setMonitorSeverityFilter(e.target.value)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All</option>
                        <option value="critical">Critical</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs font-semibold uppercase text-gray-500">
                      Ack
                      <select
                        value={monitorAckFilter}
                        onChange={(e) => setMonitorAckFilter(e.target.value)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All</option>
                        <option value="acked">Acked</option>
                        <option value="unacked">Unacked</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs font-semibold uppercase text-gray-500">
                      Mapping
                      <select
                        value={monitorMappingFilter}
                        onChange={(e) => setMonitorMappingFilter(e.target.value)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All</option>
                        <option value="unmapped">Unmapped</option>
                        <option value="stalled">Stalled</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMonitorSeverityFilter('all');
                        setMonitorAckFilter('all');
                        setMonitorMappingFilter('all');
                      }}
                      disabled={!isFilterActive}
                      className={`rounded border px-3 py-1 text-xs font-semibold transition-colors ${isFilterActive ? 'border-indigo-500 text-indigo-600 hover:bg-indigo-50' : 'border-gray-300 text-gray-400'}`}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-rose-200" aria-hidden="true" />
                    Mapping stalled
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-200" aria-hidden="true" />
                    Responder pending
                  </span>
                </div>
                <div className="max-h-96 overflow-auto rounded border border-gray-200">
                  {sortedActive.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">No incidents match the current filters.</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-white shadow-sm">
                        <tr className="text-left">
                          <th className="py-2 pl-4 pr-4">Service</th>
                          <th className="py-2 pr-4">
                            <button
                              type="button"
                              onClick={() => toggleSort('severity')}
                              className="flex items-center gap-1 text-sm font-semibold text-gray-700"
                            >
                              Severity
                              <span aria-hidden="true" className="text-xs">{sortIndicator('severity')}</span>
                              <span className="sr-only">Sort by severity</span>
                            </button>
                          </th>
                          <th className="py-2 pr-4">Dedup Key</th>
                          <th className="py-2 pr-4">Incident ID</th>
                          <th className="py-2 pr-4">Ack</th>
                          <th className="py-2 pr-4">
                            <button
                              type="button"
                              onClick={() => toggleSort('attempts')}
                              className="flex items-center gap-1 text-sm font-semibold text-gray-700"
                            >
                              Attempts
                              <span aria-hidden="true" className="text-xs">{sortIndicator('attempts')}</span>
                              <span className="sr-only">Sort by mapping attempts</span>
                            </button>
                          </th>
                          <th className="py-2 pr-4">
                            <button
                              type="button"
                              onClick={() => toggleSort('age')}
                              className="flex items-center gap-1 text-sm font-semibold text-gray-700"
                            >
                              Age
                              <span aria-hidden="true" className="text-xs">{sortIndicator('age')}</span>
                              <span className="sr-only">Sort by age</span>
                            </button>
                          </th>
                          <th className="py-2 pr-4">Next Eval</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedActive.map((rec) => {
                          const ageSeconds = rec.startedAt ? Math.floor((now - rec.startedAt) / 1000) : 0;
                          const timeToNext = rec.nextEvalAt ? Math.max(0, Math.ceil((rec.nextEvalAt - now) / 1000)) : null;
                          const mappingStalled = !rec.incidentId && (rec.mapAttempts || 0) >= 3;
                          const responderPending = !rec.responderRequested;
                          const rowClass = `border-b last:border-0 transition-colors ${mappingStalled ? 'bg-rose-50' : responderPending ? 'bg-amber-50' : ''}`;
                          const severityShade = severityTone[rec.severity] || 'bg-gray-500';
                          const acked = rec.acked;
                          return (
                            <tr key={rec.dedupKey} className={rowClass}>
                              <td className="py-3 pl-4 pr-4 align-top">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-gray-900">{rec.serviceName}</span>
                                  <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide">
                                    {mappingStalled && (
                                      <span className="rounded bg-rose-200 px-1.5 py-0.5 text-rose-800">Mapping stalled</span>
                                    )}
                                    {responderPending && (
                                      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-800">Responder pending</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-4 align-top">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase text-white ${severityShade}`}>
                                  {rec.severity}
                                </span>
                              </td>
                              <td className="py-3 pr-4 align-top font-mono text-xs text-gray-700">{rec.dedupKey}</td>
                              <td className="py-3 pr-4 align-top font-mono text-xs">
                                {rec.incidentId ? (
                                  <span>{rec.incidentId}</span>
                                ) : (
                                  <span className="text-rose-600">Pending…</span>
                                )}
                              </td>
                              <td className="py-3 pr-4 align-top">
                                {acked ? (
                                  <span className="text-green-600 font-semibold">Acked</span>
                                ) : (
                                  <span className="text-amber-700 font-semibold">Open</span>
                                )}
                              </td>
                              <td className="py-3 pr-4 align-top">{rec.mapAttempts || 0}</td>
                              <td className="py-3 pr-4 align-top">
                                <span className={ageSeconds > 300 ? 'font-semibold text-rose-600' : ''}>
                                  {formatSeconds(ageSeconds)}
                                </span>
                              </td>
                              <td className="py-3 pr-4 align-top">
                                {timeToNext != null ? formatSeconds(timeToNext) : '—'}
                              </td>
                              <td className="py-3 pr-4 align-top">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedIncident(rec)}
                                    className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                  >
                                    Details
                                  </button>
                                  <button onClick={() => addNote(rec, randomNote())} className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">Add Note</button>
                                  <button onClick={() => addResponder(rec)} className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-semibold">Add Responder</button>
                                  <button onClick={() => acknowledgeIncident(rec)} className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs font-semibold">Ack</button>
                                  <button onClick={() => resolveIncident(rec)} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-semibold">Resolve</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">Table updates live as simulations run.</p>
                  <button
                    type="button"
                    onClick={resolveAll}
                    className="rounded border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Resolve All
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded bg-white p-4 shadow">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold">Monitor Log</h2>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500">
                    <input
                      type="checkbox"
                      checked={logAutoStick}
                      onChange={(e) => setLogAutoStick(e.target.checked)}
                      className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Auto-scroll
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All', count: logCounts.all },
                    { value: 'error', label: 'Errors', count: logCounts.error },
                    { value: 'warn', label: 'Warnings', count: logCounts.warn },
                    { value: 'info', label: 'Info', count: logCounts.info },
                  ].map(({ value, label, count }) => {
                    const isActive = logFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLogFilter(value)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${isActive ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'}`}
                      >
                        {label}
                        <span className="ml-1 text-[10px] opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>
                <div
                  ref={logContainerRef}
                  className="max-h-96 overflow-auto space-y-1 rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs"
                >
                  {visibleLog.length === 0 ? (
                    <p className="text-gray-500">No log entries match the current filter.</p>
                  ) : (
                    visibleLog.map((entry, idx) => {
                      const key = `${entry.ts}-${idx}`;
                      const tone = entry.type === 'error'
                        ? 'text-red-600'
                        : entry.type === 'warn'
                        ? 'text-amber-700'
                        : 'text-gray-800';
                      return (
                        <div key={key} className={tone}>
                          [{entry.ts}] {entry.type?.toUpperCase?.()}: {entry.msg}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {selectedIncident && (
              <section className="space-y-4 rounded bg-white p-4 shadow">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Incident Details</h2>
                    <p className="text-sm text-gray-500">
                      {selectedIncident.serviceName} • {selectedIncident.dedupKey}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(null)}
                    className="rounded border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-gray-500">Incident ID</p>
                    <p className="font-mono text-sm">{selectedIncident.incidentId || 'Pending mapping'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Severity</p>
                    <p className="capitalize">{selectedIncident.severity}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Acked</p>
                    <p>{selectedIncident.acked ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Mapping attempts</p>
                    <p>{selectedIncident.mapAttempts || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Age</p>
                    <p>{formatSeconds(selectedIncident.startedAt ? Math.floor((now - selectedIncident.startedAt) / 1000) : 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Responder requested</p>
                    <p>{selectedIncident.responderRequested ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Service ID</p>
                    <p className="font-mono text-sm">{selectedIncident.serviceId}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-500">Next evaluation</p>
                    <p>
                      {selectedIncident.nextEvalAt
                        ? formatSeconds(Math.max(0, Math.ceil((selectedIncident.nextEvalAt - now) / 1000)))
                        : '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Recent log activity</h3>
                  {selectedIncidentLogs.length === 0 ? (
                    <p className="text-xs text-gray-500">No log entries referencing this incident yet.</p>
                  ) : (
                    <div className="mt-2 space-y-1 rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs">
                      {selectedIncidentLogs.map((entry, idx) => (
                        <div key={`${entry.ts}-${idx}`} className={entry.type === 'error' ? 'text-red-600' : entry.type === 'warn' ? 'text-amber-700' : 'text-gray-800'}>
                          [{entry.ts}] {entry.type?.toUpperCase?.()}: {entry.msg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
