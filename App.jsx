const HIDDEN_TEAM_PREFIXES = ["NOC - ", "SRE - "];
const NO_TEAM_ID = "__no_team__";
const NO_TEAM_NAME = "Unassigned (No Team)";
const TREND_WINDOW_MS = 15 * 60 * 1000;
const CHANGE_INTEGRATION_TYPES = ["events_api_v2_inbound_integration", "change_event_transform_inbound_integration"];
const TEMPLATE_LIBRARY_KEY = "pdns_template_library_v1";
const TEMPLATE_VERSION = 1;
const PROFILES_KEY = "pdns_profiles_v1";
const PROFILES_VERSION = 1;
const DEFAULT_PROFILE_NAME = "Default Profile";
const DEFAULT_SEVERITY_WEIGHTS = { info: 0.2, warning: 0.4, error: 0.25, critical: 0.15 };
const DEFAULT_MONITOR_SORT = { key: 'startedAt', direction: 'desc' };
const DEFAULT_RESPONDER_CONFIG = {
  prob: { critical: 0.35, nonCritical: 0.2 },
  first: {
    critical: { minSec: 30, maxSec: 120 },
    nonCritical: { minSec: 60, maxSec: 240 },
  },
};
const DEFAULT_AUTO_HEAL_CONFIG = {
  enabled: true,
  warningProbability: 0.2,
  minDelaySec: 30,
  maxDelaySec: 90,
};
const DEFAULT_SOURCE_MIX = {
  cloudwatch: 0.25,
  datadog: 0.25,
  newrelic: 0.25,
  splunk: 0.25,
};
const DEFAULT_CAMPAIGN_CONFIG = {
  enabled: true,
  probability: 0.35,
  maxRelated: 3,
  windowSec: 300,
};

function cloneTemplateValue(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function generateId(prefix = "id") {
  let unique;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    unique = crypto.randomUUID();
  } else {
    unique = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return `${prefix}_${unique}`;
}

function sanitizeProfileSettings(partial = {}) {
  const safe = (val, fallback) => (val === undefined || val === null ? fallback : val);
  const sanitizeSort = (sort) => {
    if (!sort || typeof sort !== 'object') return cloneTemplateValue(DEFAULT_MONITOR_SORT);
    const validKeys = ['startedAt', 'age', 'attempts', 'severity'];
    const key = validKeys.includes(sort.key) ? sort.key : (DEFAULT_MONITOR_SORT.key || 'startedAt');
    const direction = sort.direction === 'asc' ? 'asc' : 'desc';
    return { key, direction };
  };
  return {
    pdSubdomain: partial.pdSubdomain || "",
    apiToken: partial.apiToken || "",
    globalRoutingKey: partial.globalRoutingKey || "",
    fromEmail: partial.fromEmail || "",
    selectedTeamIds: Array.isArray(partial.selectedTeamIds) ? [...partial.selectedTeamIds] : [],
    selectedEPIds: Array.isArray(partial.selectedEPIds) ? [...partial.selectedEPIds] : [],
    includeMap: partial.includeMap && typeof partial.includeMap === 'object' ? { ...partial.includeMap } : {},
    universalResponderCfg: partial.universalResponderCfg ? cloneTemplateValue(partial.universalResponderCfg) : cloneTemplateValue(DEFAULT_RESPONDER_CONFIG),
    ratePerMinute: Number(safe(partial.ratePerMinute, 6)) || 0,
    noteProbability: Number(safe(partial.noteProbability, 0.5)) || 0,
    responderProbabilityMultiplier: Number(safe(partial.responderProbabilityMultiplier, 1)) || 0,
    autoResolveMinSec: Number(safe(partial.autoResolveMinSec, 90)) || 0,
    autoResolveMaxSec: Number(safe(partial.autoResolveMaxSec, 240)) || 0,
    severityWeights: partial.severityWeights ? cloneTemplateValue(partial.severityWeights) : cloneTemplateValue(DEFAULT_SEVERITY_WEIGHTS),
    autoHealConfig: partial.autoHealConfig ? cloneTemplateValue(partial.autoHealConfig) : cloneTemplateValue(DEFAULT_AUTO_HEAL_CONFIG),
    resumeExistingEnabled: Boolean(safe(partial.resumeExistingEnabled, true)),
    sourceMix: partial.sourceMix ? cloneTemplateValue(partial.sourceMix) : cloneTemplateValue(DEFAULT_SOURCE_MIX),
    campaignConfig: partial.campaignConfig ? cloneTemplateValue(partial.campaignConfig) : cloneTemplateValue(DEFAULT_CAMPAIGN_CONFIG),
    changeEventsEnabled: Boolean(safe(partial.changeEventsEnabled, true)),
    activeTemplateId: partial.activeTemplateId || null,
    lastRunTemplateName: partial.lastRunTemplateName || null,
    activePage: partial.activePage === 'monitor' ? 'monitor' : 'configure',
    monitorSeverityFilter: partial.monitorSeverityFilter || 'all',
    monitorAckFilter: partial.monitorAckFilter || 'all',
    monitorMappingFilter: partial.monitorMappingFilter || 'all',
    monitorSort: sanitizeSort(partial.monitorSort),
    logFilter: partial.logFilter || 'all',
    logAutoStick: partial.logAutoStick === false ? false : true,
  };
}

function createProfile({ id, name = DEFAULT_PROFILE_NAME, description = "", settings = {}, createdAt, updatedAt } = {}) {
  const ts = Date.now();
  return {
    id: id || generateId('profile'),
    version: PROFILES_VERSION,
    name,
    description,
    createdAt: createdAt || ts,
    updatedAt: updatedAt || ts,
    settings: sanitizeProfileSettings(settings),
  };
}

function sortProfiles(entries = []) {
  return [...entries].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function areSettingsEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function App() {
  // ---------- Local Storage Helpers ----------
  const LS_KEY = 'pdns_settings_v7';
  const loadLegacySettings = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
  const readStoredProfiles = () => {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.profiles)) return null;
      const normalized = parsed.profiles
        .map((profile) => {
          if (!profile?.id) return null;
          return createProfile({
            id: profile.id,
            name: profile.name || DEFAULT_PROFILE_NAME,
            description: profile.description || "",
            settings: profile.settings || {},
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          });
        })
        .filter(Boolean);
      if (!normalized.length) return null;
      const sorted = sortProfiles(normalized);
      const activeId = sorted.some((profile) => profile.id === parsed.activeProfileId)
        ? parsed.activeProfileId
        : sorted[0].id;
      return {
        profiles: sorted,
        activeProfileId: activeId,
        activeProfile: sorted.find((p) => p.id === activeId) || sorted[0],
        migrated: false,
      };
    } catch {
      return null;
    }
  };
  const bootstrapProfiles = () => {
    const stored = readStoredProfiles();
    if (stored) return stored;
    const legacy = loadLegacySettings();
    const migrated = legacy && Object.keys(legacy).length > 0;
    const fallback = createProfile({
      name: DEFAULT_PROFILE_NAME,
      description: migrated ? 'Migrated from previous settings' : 'Fresh profile',
      settings: legacy || {},
    });
    return {
      profiles: [fallback],
      activeProfileId: fallback.id,
      activeProfile: fallback,
      migrated,
    };
  };
  const sortTemplates = (entries = []) => [...entries].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const loadTemplateLibrary = () => {
    try {
      const raw = localStorage.getItem(TEMPLATE_LIBRARY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return sortTemplates(parsed.filter((tpl) => tpl?.id && tpl?.settings));
    } catch {
      return [];
    }
  };
  const persistTemplateLibrary = (entries) => {
    try {
      localStorage.setItem(TEMPLATE_LIBRARY_KEY, JSON.stringify(entries));
    } catch {}
  };
  const persistProfilesToStorage = React.useCallback((entries, activeId) => {
    try {
      const payload = {
        version: PROFILES_VERSION,
        activeProfileId: activeId || null,
        profiles: entries.map((profile) => ({
          ...profile,
          settings: sanitizeProfileSettings(profile.settings || {}),
        })),
      };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(payload));
    } catch {}
  }, []);

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
  const [universalResponderCfg, setUniversalResponderCfg] = React.useState(() => cloneTemplateValue(DEFAULT_RESPONDER_CONFIG));

  // ---------- Simulation settings ----------
  const [ratePerMinute, setRatePerMinute] = React.useState(6);
  const [noteProbability, setNoteProbability] = React.useState(0.5);
  const [responderProbabilityMultiplier, setResponderProbabilityMultiplier] = React.useState(1.0);
  const [autoResolveMinSec, setAutoResolveMinSec] = React.useState(90);
  const [autoResolveMaxSec, setAutoResolveMaxSec] = React.useState(240);
  const [severityWeights, setSeverityWeights] = React.useState(() => cloneTemplateValue(DEFAULT_SEVERITY_WEIGHTS));
  const [autoHealConfig, setAutoHealConfig] = React.useState(() => cloneTemplateValue(DEFAULT_AUTO_HEAL_CONFIG));
  const [resumeExistingEnabled, setResumeExistingEnabled] = React.useState(true);
  const [sourceMix, setSourceMix] = React.useState(() => cloneTemplateValue(DEFAULT_SOURCE_MIX));
  const [campaignConfig, setCampaignConfig] = React.useState(() => cloneTemplateValue(DEFAULT_CAMPAIGN_CONFIG));
  const [changeEventsEnabled, setChangeEventsEnabled] = React.useState(true);
  const [lastChangeEvent, setLastChangeEvent] = React.useState(null);
  const [templates, setTemplates] = React.useState(() => loadTemplateLibrary());
  const [activeTemplateId, setActiveTemplateId] = React.useState(null);
  const [templateNameInput, setTemplateNameInput] = React.useState("");
  const [templateDescriptionInput, setTemplateDescriptionInput] = React.useState("");
  const [templateError, setTemplateError] = React.useState(null);
  const [lastRunTemplateName, setLastRunTemplateName] = React.useState(null);
  const [profiles, setProfiles] = React.useState([]);
  const [activeProfileId, setActiveProfileId] = React.useState(null);
  const [profileNameInput, setProfileNameInput] = React.useState("");
  const [profileDescriptionInput, setProfileDescriptionInput] = React.useState("");
  const [profileError, setProfileError] = React.useState(null);
  const [profileMigrationBanner, setProfileMigrationBanner] = React.useState(false);
  const [profilesReady, setProfilesReady] = React.useState(false);

  const [isRunning, setIsRunning] = React.useState(false);
  const [log, setLog] = React.useState([]);
  // active rec: { dedupKey, serviceId, serviceName, startedAt, incidentId, mapAttempts, nextEvalAt, ackAt, acked, firstResponderAt, responderRequested, severity }
  const [active, setActive] = React.useState([]);
  const [activePage, setActivePage] = React.useState('configure');
  const [monitorSeverityFilter, setMonitorSeverityFilter] = React.useState('all');
  const [monitorAckFilter, setMonitorAckFilter] = React.useState('all');
  const [monitorMappingFilter, setMonitorMappingFilter] = React.useState('all');
  const [monitorSort, setMonitorSort] = React.useState(() => cloneTemplateValue(DEFAULT_MONITOR_SORT));
  const [selectedIncident, setSelectedIncident] = React.useState(null);
  const [monitorTrend, setMonitorTrend] = React.useState([]);
  const [logFilter, setLogFilter] = React.useState('all');
  const [logAutoStick, setLogAutoStick] = React.useState(true);
  const activeProfile = React.useMemo(() => profiles.find((profile) => profile.id === activeProfileId) || null, [profiles, activeProfileId]);
  const activeTemplate = React.useMemo(() => templates.find((tpl) => tpl.id === activeTemplateId) || null, [templates, activeTemplateId]);

  // Timers/refs for schedulers
  const fireTimerRef = React.useRef(null);
  const evalTimerRef = React.useRef(null);
  const logContainerRef = React.useRef(null);
  const latestActiveRef = React.useRef(0);
  const campaignRef = React.useRef([]);
  const changeEventsToggleTouchedRef = React.useRef(false);
  const restLimiterRef = React.useRef({
    tokens: 25,
    capacity: 25,
    refillRatePerSec: 2.5,
    queue: [],
    lastRefill: Date.now(),
  });
  const takeRestToken = React.useCallback(() => {
    const limiter = restLimiterRef.current;
    const now = Date.now();
    const elapsed = (now - limiter.lastRefill) / 1000;
    if (elapsed > 0) {
      limiter.tokens = Math.min(limiter.capacity, limiter.tokens + elapsed * limiter.refillRatePerSec);
      limiter.lastRefill = now;
    }
    if (limiter.tokens >= 1) {
      limiter.tokens -= 1;
      return true;
    }
    return false;
  }, []);

  const throttledFetch = React.useCallback(async (url, options = {}) => {
    if (typeof url === "string" && url.startsWith("/proxy/events")) {
      return fetch(url, options);
    }
    const limiter = restLimiterRef.current;
    return new Promise((resolve, reject) => {
      const run = () => {
        fetch(url, options).then(resolve).catch(reject);
      };
      if (takeRestToken()) {
        run();
      } else {
        limiter.queue.push(run);
        if (limiter.queue.length === 1) {
          logMsg("REST API throttled locally; delaying requests to stay within limits", "warn");
        }
      }
    });
  }, [takeRestToken]);
  React.useEffect(() => {
    persistTemplateLibrary(templates);
  }, [templates]);
  React.useEffect(() => {
    if (activeTemplateId && !templates.some((tpl) => tpl.id === activeTemplateId)) {
      setActiveTemplateId(null);
    }
  }, [activeTemplateId, templates]);

  React.useEffect(() => {
    let cancelled = false;
    function processQueue() {
      if (cancelled) return;
      const limiter = restLimiterRef.current;
      if (limiter.queue.length === 0) return;
      if (takeRestToken()) {
        const next = limiter.queue.shift();
        if (next) next();
      }
    }
    const interval = setInterval(processQueue, 200);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [takeRestToken]);

  // ---------- Load Profiles on mount ----------
  React.useEffect(() => {
    const payload = bootstrapProfiles();
    setProfiles(payload.profiles);
    setActiveProfileId(payload.activeProfileId);
    if (payload.activeProfile) {
      applyProfileSettings(payload.activeProfile.settings || {});
      setProfileNameInput(payload.activeProfile.name || "");
      setProfileDescriptionInput(payload.activeProfile.description || "");
    }
    setProfileMigrationBanner(Boolean(payload.migrated));
    setProfilesReady(true);
  }, []);

  React.useEffect(() => {
    if (!profilesReady) return;
    persistProfilesToStorage(profiles, activeProfileId);
  }, [profiles, activeProfileId, profilesReady, persistProfilesToStorage]);

  const captureProfileSettings = React.useCallback(() => sanitizeProfileSettings({
    pdSubdomain,
    apiToken,
    globalRoutingKey,
    fromEmail,
    selectedTeamIds,
    selectedEPIds,
    includeMap,
    universalResponderCfg,
    ratePerMinute,
    noteProbability,
    responderProbabilityMultiplier,
    autoResolveMinSec,
    autoResolveMaxSec,
    severityWeights,
    autoHealConfig,
    resumeExistingEnabled,
    sourceMix,
    campaignConfig,
    changeEventsEnabled,
    activeTemplateId,
    lastRunTemplateName,
    activePage,
    monitorSeverityFilter,
    monitorAckFilter,
    monitorMappingFilter,
    monitorSort,
    logFilter,
    logAutoStick,
  }), [
    pdSubdomain,
    apiToken,
    globalRoutingKey,
    fromEmail,
    selectedTeamIds,
    selectedEPIds,
    includeMap,
    universalResponderCfg,
    ratePerMinute,
    noteProbability,
    responderProbabilityMultiplier,
    autoResolveMinSec,
    autoResolveMaxSec,
    severityWeights,
    autoHealConfig,
    resumeExistingEnabled,
    sourceMix,
    campaignConfig,
    changeEventsEnabled,
    activeTemplateId,
    lastRunTemplateName,
    activePage,
    monitorSeverityFilter,
    monitorAckFilter,
    monitorMappingFilter,
    monitorSort,
    logFilter,
    logAutoStick,
  ]);

  const captureTemplateSettings = React.useCallback(() => ({
    pdSubdomain,
    fromEmail,
    selectedTeamIds,
    selectedEPIds,
    includeMap,
    universalResponderCfg,
    ratePerMinute,
    noteProbability,
    responderProbabilityMultiplier,
    autoResolveMinSec,
    autoResolveMaxSec,
    severityWeights,
    autoHealConfig,
    resumeExistingEnabled,
    sourceMix,
    campaignConfig,
    changeEventsEnabled,
  }), [
    pdSubdomain,
    fromEmail,
    selectedTeamIds,
    selectedEPIds,
    includeMap,
    universalResponderCfg,
    ratePerMinute,
    noteProbability,
    responderProbabilityMultiplier,
    autoResolveMinSec,
    autoResolveMaxSec,
    severityWeights,
    autoHealConfig,
    resumeExistingEnabled,
    sourceMix,
    campaignConfig,
    changeEventsEnabled,
  ]);

  React.useEffect(() => {
    if (!profilesReady || !activeProfileId) return;
    const snapshot = captureProfileSettings();
    setProfiles((prev) => {
      const idx = prev.findIndex((profile) => profile.id === activeProfileId);
      if (idx === -1) return prev;
      const current = prev[idx];
      if (areSettingsEqual(current.settings, snapshot)) return prev;
      const updated = [...prev];
      updated[idx] = { ...current, settings: snapshot, version: PROFILES_VERSION };
      return updated;
    });
  }, [profilesReady, activeProfileId, captureProfileSettings]);

  React.useEffect(() => {
    if (!activeProfile) return;
    setProfileNameInput(activeProfile.name || "");
    setProfileDescriptionInput(activeProfile.description || "");
  }, [activeProfile]);

  function applyTemplateSettings(incomingSettings = {}) {
    const settings = cloneTemplateValue(incomingSettings) || {};
    if ("pdSubdomain" in settings) setPdSubdomain(settings.pdSubdomain || "");
    if ("fromEmail" in settings) setFromEmail(settings.fromEmail || "");
    if ("selectedTeamIds" in settings) setSelectedTeamIds(Array.isArray(settings.selectedTeamIds) ? settings.selectedTeamIds : []);
    if ("selectedEPIds" in settings) setSelectedEPIds(Array.isArray(settings.selectedEPIds) ? settings.selectedEPIds : []);
    if ("includeMap" in settings) setIncludeMap(settings.includeMap || {});
    if ("universalResponderCfg" in settings) setUniversalResponderCfg(settings.universalResponderCfg || cloneTemplateValue(DEFAULT_RESPONDER_CONFIG));
    if ("ratePerMinute" in settings) setRatePerMinute(Number(settings.ratePerMinute) || 0);
    if ("noteProbability" in settings) setNoteProbability(Number(settings.noteProbability) || 0);
    if ("responderProbabilityMultiplier" in settings) setResponderProbabilityMultiplier(Number(settings.responderProbabilityMultiplier) || 0);
    if ("autoResolveMinSec" in settings) setAutoResolveMinSec(Number(settings.autoResolveMinSec) || 0);
    if ("autoResolveMaxSec" in settings) setAutoResolveMaxSec(Number(settings.autoResolveMaxSec) || 0);
    if ("severityWeights" in settings) setSeverityWeights(settings.severityWeights || cloneTemplateValue(DEFAULT_SEVERITY_WEIGHTS));
    if ("autoHealConfig" in settings) setAutoHealConfig(settings.autoHealConfig || cloneTemplateValue(DEFAULT_AUTO_HEAL_CONFIG));
    if ("resumeExistingEnabled" in settings) setResumeExistingEnabled(Boolean(settings.resumeExistingEnabled));
    if ("sourceMix" in settings) setSourceMix(settings.sourceMix || cloneTemplateValue(DEFAULT_SOURCE_MIX));
    if ("campaignConfig" in settings) setCampaignConfig(settings.campaignConfig || cloneTemplateValue(DEFAULT_CAMPAIGN_CONFIG));
    if ("changeEventsEnabled" in settings) setChangeEventsEnabled(Boolean(settings.changeEventsEnabled));
  }

  function applyProfileSettings(incomingSettings = {}) {
    const settings = sanitizeProfileSettings(incomingSettings);
    setPdSubdomain(settings.pdSubdomain || "");
    setApiToken(settings.apiToken || "");
    setGlobalRoutingKey(settings.globalRoutingKey || "");
    setFromEmail(settings.fromEmail || "");
    setSelectedTeamIds(Array.isArray(settings.selectedTeamIds) ? settings.selectedTeamIds : []);
    setSelectedEPIds(Array.isArray(settings.selectedEPIds) ? settings.selectedEPIds : []);
    setIncludeMap(settings.includeMap || {});
    setUniversalResponderCfg(settings.universalResponderCfg || cloneTemplateValue(DEFAULT_RESPONDER_CONFIG));
    setRatePerMinute(Number(settings.ratePerMinute) || 0);
    setNoteProbability(Number(settings.noteProbability) || 0);
    setResponderProbabilityMultiplier(Number(settings.responderProbabilityMultiplier) || 0);
    setAutoResolveMinSec(Number(settings.autoResolveMinSec) || 0);
    setAutoResolveMaxSec(Number(settings.autoResolveMaxSec) || 0);
    setSeverityWeights(settings.severityWeights || cloneTemplateValue(DEFAULT_SEVERITY_WEIGHTS));
    setAutoHealConfig(settings.autoHealConfig || cloneTemplateValue(DEFAULT_AUTO_HEAL_CONFIG));
    setResumeExistingEnabled(Boolean(settings.resumeExistingEnabled));
    setSourceMix(settings.sourceMix || cloneTemplateValue(DEFAULT_SOURCE_MIX));
    setCampaignConfig(settings.campaignConfig || cloneTemplateValue(DEFAULT_CAMPAIGN_CONFIG));
    setChangeEventsEnabled(Boolean(settings.changeEventsEnabled));
    if (settings.activeTemplateId !== undefined) setActiveTemplateId(settings.activeTemplateId || null);
    if ('lastRunTemplateName' in settings) setLastRunTemplateName(settings.lastRunTemplateName || null);
    setActivePage(settings.activePage === 'monitor' ? 'monitor' : 'configure');
    setMonitorSeverityFilter(settings.monitorSeverityFilter || 'all');
    setMonitorAckFilter(settings.monitorAckFilter || 'all');
    setMonitorMappingFilter(settings.monitorMappingFilter || 'all');
    setMonitorSort(settings.monitorSort || cloneTemplateValue(DEFAULT_MONITOR_SORT));
    setLogFilter(settings.logFilter || 'all');
    setLogAutoStick(settings.logAutoStick === false ? false : true);
  }

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

  const handleSaveTemplate = () => {
    const trimmedName = templateNameInput.trim();
    if (!trimmedName) {
      setTemplateError("Template name is required");
      return;
    }
    const snapshot = captureTemplateSettings();
    const nowTs = Date.now();
    const template = {
      id: generateId("tpl"),
      name: trimmedName,
      description: templateDescriptionInput.trim(),
      version: TEMPLATE_VERSION,
      createdAt: nowTs,
      updatedAt: nowTs,
      settings: cloneTemplateValue(snapshot) || {},
    };
    setTemplates((prev) => sortTemplates([template, ...prev]));
    setActiveTemplateId(template.id);
    setTemplateNameInput("");
    setTemplateDescriptionInput("");
    setTemplateError(null);
    logMsg(`Saved template "${trimmedName}"`, "info");
  };

  const handleApplyTemplate = (templateId) => {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    applyTemplateSettings(template.settings || {});
    setActiveTemplateId(template.id);
    setTemplateNameInput(template.name || "");
    setTemplateDescriptionInput(template.description || "");
    setTemplateError(null);
    logMsg(`Template "${template.name}" loaded into Configure view`, "info");
  };

  const handleOverwriteTemplate = (templateId) => {
    const snapshot = captureTemplateSettings();
    const nowTs = Date.now();
    let templateName = "";
    setTemplates((prev) => {
      const idx = prev.findIndex((tpl) => tpl.id === templateId);
      if (idx === -1) return prev;
      templateName = prev[idx].name || "";
      const updated = [...prev];
      updated[idx] = {
        ...prev[idx],
        settings: cloneTemplateValue(snapshot) || {},
        updatedAt: nowTs,
        version: TEMPLATE_VERSION,
      };
      return sortTemplates(updated);
    });
    if (templateName) {
      logMsg(`Template "${templateName}" updated`, "info");
    }
  };

  const handleDeleteTemplate = (templateId) => {
    let removedName = "";
    setTemplates((prev) => {
      const template = prev.find((tpl) => tpl.id === templateId);
      if (!template) return prev;
      removedName = template.name || "";
      return prev.filter((tpl) => tpl.id !== templateId);
    });
    if (activeTemplateId === templateId) {
      setActiveTemplateId(null);
    }
    if (removedName) {
      logMsg(`Deleted template "${removedName}"`, "warn");
    }
  };

  const handleSelectProfile = (profileId) => {
    if (!profileId || profileId === activeProfileId) return;
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    applyProfileSettings(profile.settings || {});
    setActiveProfileId(profile.id);
    setProfileNameInput(profile.name || "");
    setProfileDescriptionInput(profile.description || "");
    setProfileError(null);
    logMsg(`Profile "${profile.name || profile.id}" loaded`, "info");
  };

  const handleSaveProfile = () => {
    if (!activeProfileId) return;
    const trimmedName = profileNameInput.trim();
    if (!trimmedName) {
      setProfileError("Profile name is required");
      return;
    }
    const trimmedDesc = profileDescriptionInput.trim();
    const snapshot = captureProfileSettings();
    const nowTs = Date.now();
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === activeProfileId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...prev[idx],
        name: trimmedName,
        description: trimmedDesc,
        updatedAt: nowTs,
        settings: snapshot,
        version: PROFILES_VERSION,
      };
      return sortProfiles(updated);
    });
    setProfileError(null);
    logMsg(`Profile "${trimmedName}" saved`, "info");
  };

  const handleSaveAsProfile = () => {
    const trimmedName = profileNameInput.trim();
    if (!trimmedName) {
      setProfileError("Profile name is required");
      return;
    }
    const trimmedDesc = profileDescriptionInput.trim();
    const snapshot = captureProfileSettings();
    const nowTs = Date.now();
    const newProfile = {
      id: generateId('profile'),
      version: PROFILES_VERSION,
      name: trimmedName,
      description: trimmedDesc,
      createdAt: nowTs,
      updatedAt: nowTs,
      settings: snapshot,
    };
    setProfiles((prev) => sortProfiles([newProfile, ...prev]));
    setActiveProfileId(newProfile.id);
    setProfileError(null);
    logMsg(`Created new profile "${trimmedName}"`, "info");
  };

  const handleCreateProfile = () => {
    const newProfile = createProfile({
      name: `Profile ${profiles.length + 1}`,
      description: "",
      settings: sanitizeProfileSettings({}),
    });
    setProfiles((prev) => sortProfiles([newProfile, ...prev]));
    setActiveProfileId(newProfile.id);
    applyProfileSettings(newProfile.settings || {});
    setProfileNameInput(newProfile.name || "");
    setProfileDescriptionInput(newProfile.description || "");
    setProfileError(null);
    logMsg(`Created profile "${newProfile.name}"`, "info");
  };

  const handleDeleteProfile = () => {
    if (!activeProfileId) return;
    if (profiles.length <= 1) {
      setProfileError("Keep at least one profile");
      return;
    }
    const target = profiles.find((p) => p.id === activeProfileId);
    const remaining = profiles.filter((p) => p.id !== activeProfileId);
    const sorted = sortProfiles(remaining);
    const fallback = sorted[0];
    setProfiles(sorted);
    if (fallback) {
      setActiveProfileId(fallback.id);
      applyProfileSettings(fallback.settings || {});
      setProfileNameInput(fallback.name || "");
      setProfileDescriptionInput(fallback.description || "");
    }
    setProfileError(null);
    logMsg(`Profile "${target?.name || target?.id || 'profile'}" deleted`, "warn");
  };

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
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
const NOTE_LIBRARY = {
  general: [
    "Investigating telemetry anomalies",
    "Validating dashboards with SREs",
    "Coordinating with platform team",
    "Collecting rollout data for comparison"
  ],
};
const FAILURE_NARRATIVES = [
  "Shared database latency impacting dependent services",
  "Downstream cache cluster eviction storm",
  "Regional network flap observed by backbone monitors",
  "Partial deploy stuck across AZs",
  "Throttling on shared integration endpoint",
];
function randomFailureSummary(teamName) {
  const base = randomFrom(FAILURE_NARRATIVES);
  return teamName ? `${base} (${teamName})` : base;
}
const OBS_SOURCE_TEMPLATES = [
  {
    id: "cloudwatch",
    label: "AWS CloudWatch Alarm",
    metrics: ["CPUUtilization", "RequestLatency", "Throttles", "HTTP5xx", "HealthyHostCount"],
    regions: ["us-east-1", "us-west-2", "eu-west-1"],
    build(svc, failureMeta) {
      const metric = randomFrom(this.metrics);
      const region = randomFrom(this.regions);
      const threshold = (50 + Math.random() * 40).toFixed(0);
      const value = (Number(threshold) + Math.random() * 30).toFixed(1);
      return {
        summary: `[CloudWatch] ${metric} breaching on ${svc.name}`,
        source: `cw.${region}.amazonaws.com`,
        component: svc.name,
        custom_details: {
          metric, region,
          threshold,
          observed_value: value,
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        noteTemplates: [
          `CloudWatch alarm ${metric} breached ${value}/${threshold} in ${region}`,
          `Auto-remediation evaluating ASG scaling for ${svc.name}`,
        ],
      };
    },
  },
  {
    id: "datadog",
    label: "Datadog Monitor",
    build(svc, failureMeta) {
      const monitor = randomFrom(["request.error_rate", "latency.p95", "kafka.lag", "db.connections"]);
      return {
        summary: `[Datadog] ${monitor} abnormal for ${svc.name}`,
        source: `datadoghq.com/monitors/${Math.floor(Math.random() * 90000)}`,
        component: svc.name,
        custom_details: {
          monitor,
          status: randomFrom(["Alert", "Warn"]),
          tags: ["team:sre", `service:${svc.name}`],
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        noteTemplates: [
          `Datadog monitor ${monitor} firing with correlated tags`,
          "Reviewing APM traces for shared dependency impact",
        ],
      };
    },
  },
  {
    id: "newrelic",
    label: "New Relic APM",
    build(svc, failureMeta) {
      const transaction = randomFrom(["/api/login", "/jobs/process", "/graphql/query", "/internal/reconcile"]);
      return {
        summary: `[NewRelic] Slow transaction ${transaction} on ${svc.name}`,
        source: "newrelic.com/apm",
        component: transaction,
        custom_details: {
          transaction,
          apdex: (0.3 + Math.random() * 0.3).toFixed(2),
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        noteTemplates: [
          `NR traces show ${transaction} allocating extra memory`,
          "Comparing golden signals against previous deploy",
        ],
      };
    },
  },
  {
    id: "splunk",
    label: "Splunk On-Call",
    build(svc, failureMeta) {
      const signature = randomFrom(["NullPointerException", "TimeoutError", "ConnectionReset", "CircuitBreakerOpen"]);
      return {
        summary: `[Splunk] ${signature} pattern detected in ${svc.name}`,
        source: "splunkcloud.com",
        component: svc.name,
        custom_details: {
          signature,
          sample_log: `${signature}: ${svc.name} failing to reach upstream`,
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        noteTemplates: [
          `Splunk saved search matched ${signature}`,
          "Investigating correlated log spikes across services",
        ],
      };
    },
  },
];
function randomNote(rec) {
  const pool = rec?.noteContext?.length ? rec.noteContext : NOTE_LIBRARY.general;
  let note = randomFrom(pool);
  if (rec?.failureSummary && Math.random() < 0.4) {
    note += ` (related to ${rec.failureSummary})`;
  }
  return note;
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
      const res = await throttledFetch(url.toString(), { headers: apiHeaders });
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
  // ---------- Load Teams ----------
  async function fetchAllTeams() {
    if (!apiToken) { logMsg("Provide a REST API token to load teams", "warn"); return; }
    setIsLoadingTeams(true);
    try {
      const out = []; let offset = 0; const limit = 100; let more = true;
      while (more) {
        const url = new URL("/proxy/teams", window.location.origin);
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        const res = await throttledFetch(url.toString(), { headers: apiHeaders });
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
      const out = []; let offset = 0; const limit = 100; let more = true; let changeEnabled = 0;
      while (more) {
        const url = new URL("/proxy/services", window.location.origin);
        url.searchParams.set("limit", String(limit)); url.searchParams.set("offset", String(offset));
        url.searchParams.append("include[]", "teams");
        url.searchParams.append("include[]", "integrations");
        selectedTeamIds.forEach((id) => url.searchParams.append("team_ids[]", id));
        const res = await throttledFetch(url.toString(), { headers: apiHeaders });
        const data = await res.json(); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
        const batch = (data?.services || []).map((s) => ({
          id: s.id,
          name: s.name,
          html_url: s.html_url,
          include: includeMap[s.id] ?? false, // persist selection
          teams: (s.teams || []).map((t) => ({ id: t.id, name: t.name })),
          changeIntegrations: (s.integrations || [])
            .filter((integration) => CHANGE_INTEGRATION_TYPES.includes(integration?.type) && integration.integration_key)
            .map((integration) => ({
              id: integration.id,
              name: integration.summary || integration.name || integration.type,
              integrationKey: integration.integration_key,
              vendor: integration.vendor?.summary || integration.vendor?.name || null,
            })),
        }));
        batch.forEach((svc) => { if (svc.changeIntegrations.length) changeEnabled += 1; });
        out.push(...batch);
        more = Boolean(data?.more); offset += data?.limit || batch.length || 0;
      }
      out.sort((a, b) => a.name.localeCompare(b.name)); setServices(out);
      logMsg(`Loaded ${out.length} services${selectedTeamIds.length ? ` (filtered by ${selectedTeamIds.length} team(s))` : ''}${changeEnabled ? ` (${changeEnabled} with change integrations)` : ''}`);
      return out;
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
        const res = await throttledFetch(url.toString(), { headers: apiHeaders });
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

  const resumeInFlightRef = React.useRef(false);
  async function resumeExistingIncidents(serviceSnapshot = services) {
    if (!resumeExistingEnabled) return;
    if (!apiToken) { logMsg("API token required to resume existing incidents", "warn"); return; }
    const includedIds = (serviceSnapshot && serviceSnapshot.length ? serviceSnapshot : services)
      .filter((svc) => svc.include)
      .map((svc) => svc.id)
      .filter(Boolean);
    if (!includedIds.length) {
      logMsg("No included services selected; skipping resume of existing incidents", "warn");
      return;
    }
    if (resumeInFlightRef.current) return;
    resumeInFlightRef.current = true;
    try {
      const statuses = ["triggered", "acknowledged"];
      const limit = 100;
      let offset = 0;
      let more = true;
      const collected = [];
      while (more) {
        const url = new URL("/proxy/incidents", window.location.origin);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));
        statuses.forEach((status) => url.searchParams.append("statuses[]", status));
        includedIds.forEach((svcId) => url.searchParams.append("service_ids[]", svcId));
        const res = await throttledFetch(url.toString(), { headers: apiHeaders });
        const data = await res.json(); if (!res.ok) throw new Error(data?.error?.message || res.statusText);
        const mapped = (data?.incidents || []).map(mapPdIncidentToActive).filter(Boolean);
        collected.push(...mapped);
        more = Boolean(data?.more);
        offset += data?.limit || mapped.length || 0;
      }
      if (!collected.length) {
        logMsg("No existing PagerDuty incidents found for selected services", "info");
        return;
      }
      let insertedCount = 0;
      setActive((prev) => {
        const dedup = new Set(prev.map((rec) => rec.dedupKey));
        const ids = new Set(prev.map((rec) => rec.incidentId).filter(Boolean));
        const toAdd = collected.filter((rec) => {
          if (dedup.has(rec.dedupKey)) return false;
          if (rec.incidentId && ids.has(rec.incidentId)) return false;
          return true;
        });
        insertedCount = toAdd.length;
        if (!insertedCount) return prev;
        return [...prev, ...toAdd];
      });
      if (insertedCount) {
        logMsg(`Resumed ${insertedCount} PagerDuty incident${insertedCount === 1 ? '' : 's'}`, "info");
      } else {
        logMsg("Existing incidents already tracked; nothing new to resume", "info");
      }
    } catch (e) {
      logMsg(`Failed to resume incidents: ${e.message || e}`, "error");
    } finally {
      resumeInFlightRef.current = false;
    }
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

  const serviceNameLookup = React.useMemo(() => {
    const map = {};
    services.forEach((svc) => { map[svc.id] = svc.name; });
    return map;
  }, [services]);

  const changeTargetsByTeam = React.useMemo(() => {
    const map = {};
    services.forEach((svc) => {
      if (!svc.include) return;
      const integrations = Array.isArray(svc.changeIntegrations) ? svc.changeIntegrations : [];
      if (!integrations.length) return;
      const svcTeams = Array.isArray(svc.teams) && svc.teams.length > 0
        ? svc.teams
        : [{ id: NO_TEAM_ID, name: NO_TEAM_NAME }];
      svcTeams.forEach((team) => {
        if (!map[team.id]) {
          map[team.id] = { team, services: [] };
        }
        map[team.id].services.push({
          serviceId: svc.id,
          serviceName: svc.name,
          integrations,
          teamId: team.id,
          teamName: team.name,
        });
      });
    });
    return map;
  }, [services]);

  const changeCoverage = React.useMemo(() => {
    const included = services.filter((svc) => svc.include);
    const includedWithChange = included.filter((svc) => Array.isArray(svc.changeIntegrations) && svc.changeIntegrations.length > 0).length;
    const totalChange = services.filter((svc) => Array.isArray(svc.changeIntegrations) && svc.changeIntegrations.length > 0).length;
    return {
      included: included.length,
      includedWithChange,
      total: services.length,
      totalChange,
    };
  }, [services]);

  const changeIntegrationStats = React.useMemo(() => ({
    scanned: services.length,
    withChange: services.filter((svc) => Array.isArray(svc.changeIntegrations) && svc.changeIntegrations.length > 0).length,
  }), [services]);

  const changeCoverageSummary = React.useMemo(() => {
    const entries = Object.values(changeTargetsByTeam).map((entry) => {
      const teamName = entry.team?.name || "Unknown Team";
      return `${teamName}: ${entry.services.length}`;
    });
    if (!entries.length) return null;
    if (entries.length <= 3) return entries.join(" • ");
    return `${entries.slice(0, 3).join(" • ")} +${entries.length - 3} more`;
  }, [changeTargetsByTeam]);

  const hasChangeCoverage = changeCoverage.totalChange > 0;

  React.useEffect(() => {
    if (!hasChangeCoverage) {
      changeEventsToggleTouchedRef.current = false;
      if (changeEventsEnabled) setChangeEventsEnabled(false);
      return;
    }
    if (!changeEventsEnabled && !changeEventsToggleTouchedRef.current) {
      setChangeEventsEnabled(true);
    }
  }, [hasChangeCoverage, changeEventsEnabled]);

  const emitChangeEventForService = React.useCallback(async (target, campaignMeta, team) => {
    if (!target?.integrations?.length) return;
    const integration = randomFrom(target.integrations);
    if (!integration?.integrationKey) return;
    const body = {
      routing_key: integration.integrationKey,
      event_action: "trigger",
      payload: {
        summary: `[Change] ${target.serviceName} update related to ${campaignMeta.summary}`,
        source: "PD Noise Simulator",
        component: target.serviceName,
        timestamp: new Date().toISOString(),
        custom_details: {
          failure_id: campaignMeta.id,
          failure_summary: campaignMeta.summary,
          service_id: target.serviceId,
          team: team?.name || "Unknown Team",
        },
      },
    };
    try {
      const res = await fetch("/proxy/change_events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || res.statusText);
      setLastChangeEvent({ ts: Date.now(), serviceName: target.serviceName, failureSummary: campaignMeta.summary });
      logMsg(`Sent change event for ${target.serviceName} (${campaignMeta.summary})`, "info");
    } catch (e) {
      logMsg(`Failed to send change event for ${target.serviceName}: ${e.message || e}`, "warn");
    }
  }, [logMsg]);

  const triggerCampaignChangeEvents = React.useCallback((team, campaignMeta, originService) => {
    if (!changeEventsEnabled) return;
    if (!team?.id) return;
    const teamTargets = changeTargetsByTeam[team.id];
    const available = teamTargets?.services ? [...teamTargets.services] : [];
    if (!available.length) {
      logMsg(`No change integrations selected for ${team?.name || "team"}; skipping change events`, "info");
      return;
    }
    const picks = [];
    const originIdx = available.findIndex((entry) => entry.serviceId === originService.id);
    if (originIdx >= 0) {
      picks.push(available.splice(originIdx, 1)[0]);
    }
    const maxPerCampaign = Math.min(3, available.length + picks.length);
    const desired = Math.min(maxPerCampaign, Math.max(1, Math.floor(Math.random() * 3) + 1));
    const shuffled = shuffleArray(available);
    while (picks.length < desired && shuffled.length) {
      picks.push(shuffled.shift());
    }
    picks.forEach((target) => emitChangeEventForService(target, campaignMeta, team));
  }, [changeEventsEnabled, changeTargetsByTeam, emitChangeEventForService, logMsg]);

  const mapPdIncidentToActive = React.useCallback((inc) => {
    if (!inc) return null;
    const serviceId = inc.service?.id || inc.service_id;
    const serviceName = serviceNameLookup[serviceId] || inc.service?.summary || inc.summary || "Unknown Service";
    const dedupKey = inc.incident_key || inc.dedup_key || inc.id || generateId("pd");
    const startedAt = inc.created_at ? new Date(inc.created_at).getTime() : Date.now();
    const severity = inc.severity || "info";
    const acked = inc.status === "acknowledged";
    return {
      dedupKey,
      serviceId,
      serviceName,
      startedAt,
      incidentId: inc.id || null,
      mapAttempts: 0,
      nextEvalAt: Date.now() + 60_000,
      ackAt: null,
      acked,
      firstResponderAt: null,
      responderRequested: Boolean(inc.pending_actions && inc.pending_actions.length),
      severity,
      resolveAt: null,
      autoHealAt: null,
      autoHealScheduled: false,
      observabilitySource: "PagerDuty",
      failureId: inc?.custom_details?.failure_id || null,
      failureSummary: inc?.custom_details?.failure_summary || null,
      noteContext: [],
      syncedFromPd: true,
    };
  }, [serviceNameLookup]);

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
  async function triggerIncidentForService(svc, campaignContext = null) {
    if (!globalRoutingKey) { logMsg("Provide the Global Routing Key", "warn"); return null; }
    const dedupKey = generateId("dk");
    const severity = randChoiceWeighted(severityWeights);
    const template = selectObservabilityTemplate();
    let failureMeta = campaignContext || null;
    try {
      if (!failureMeta) {
        failureMeta = startCampaignForService(svc);
      }
      const templatePayload = template.build(svc, failureMeta);
      const customDetails = {
        service_name: svc.name,
        simulator: "PagerDuty Noise Simulator",
        seed: dedupKey,
        severity,
        observability_source: template.label,
        failure_id: failureMeta?.id || templatePayload?.custom_details?.failure_id,
        failure_summary: failureMeta?.summary || templatePayload?.custom_details?.failure_summary,
        ...(templatePayload?.custom_details || {}),
      };
      const body = {
        routing_key: globalRoutingKey.trim(),
        event_action: "trigger",
        dedup_key: dedupKey,
        payload: {
          summary: templatePayload.summary || randomSummary(svc.name),
          source: templatePayload.source || randomSource(),
          severity,
          component: templatePayload.component || svc.name,
          group: templatePayload.group || svc.name,
          class: templatePayload.className || templatePayload.class || "demo",
          custom_details: customDetails,
        },
        client: "PD Noise Simulator",
        client_url: "https://example.local/simulator",
      };
      const res = await fetch("/proxy/events", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Events API error: ${res.status} ${data?.message || res.statusText}`);
      const cfg = universalResponderCfg;
      const now = Date.now();
      const isCrit = severity === 'critical';
      const win = isCrit ? cfg.first.critical : cfg.first.nonCritical;
      const firstResponderDelay = (win.minSec + Math.random() * Math.max(0, win.maxSec - win.minSec)) * 1000;
      const ackDelay = (30 + Math.random() * (300 - 30)) * 1000;
      const resolveDelay = (Math.min(autoResolveMinSec, autoResolveMaxSec) + Math.random() * Math.abs(autoResolveMaxSec - autoResolveMinSec)) * 1000;
      logMsg(`Triggered incident for ${svc.name} (severity=${severity}) dk=${dedupKey} via ${template.label}`);
      if (severity === 'info') {
        logMsg(`Info severity suppressed; not tracking incident ${dedupKey}`, "info");
        return null;
      }
      const shouldAutoHeal = severity === 'warning' && autoHealConfig?.enabled && Math.random() < Number(autoHealConfig.warningProbability || 0);
      const autoHealDelay = shouldAutoHeal
        ? (Math.min(autoHealConfig.minDelaySec, autoHealConfig.maxDelaySec) + Math.random() * Math.abs(autoHealConfig.maxDelaySec - autoHealConfig.minDelaySec)) * 1000
        : null;
      const record = {
        dedupKey,
        serviceId: svc.id,
        serviceName: svc.name,
        startedAt: now,
        incidentId: null,
        mapAttempts: 0,
        nextEvalAt: now + 60_000,
        ackAt: now + ackDelay,
        acked: false,
        firstResponderAt: now + firstResponderDelay,
        responderRequested: false,
        severity,
        resolveAt: now + resolveDelay,
        autoHealAt: autoHealDelay ? now + autoHealDelay : null,
        autoHealScheduled: shouldAutoHeal,
        observabilitySource: template.label,
        noteContext: templatePayload.noteTemplates || [],
        failureId: customDetails.failure_id || null,
        failureSummary: customDetails.failure_summary || null,
        syncedFromPd: false,
      };
      setActive((a) => [record, ...a]);
      setTimeout(() => resolveIncidentIdForDedupKey(record, true).catch((e) => logMsg(e.message, "warn")), 4000);
      return record;
    } catch (e) {
      logMsg(e.message || String(e), "error");
      return null;
    }
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
        const campaignSelection = popCampaignService();
        const svc = campaignSelection?.svc || randomFrom(targets);
        await triggerIncidentForService(svc, campaignSelection?.metadata);
      }
      // Schedule next regardless
      scheduleNextFire();
    }, delayMs);
  }, [isRunning, ratePerMinute, services, popCampaignService]);

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
  }, [isRunning, noteProbability, responderProbabilityMultiplier, services, apiToken, fromEmail, globalRoutingKey, universalResponderCfg, selectedEPIds, autoResolveMinSec, autoResolveMaxSec, autoHealConfig]);

  // ---------- Auto-heal ticker (always running) ----------
  const autoHealTickerRef = React.useRef(null);
  React.useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const toHeal = [];
      setActive((prev) => prev.map((rec) => {
        if (rec.autoHealScheduled && rec.autoHealAt && Date.now() >= rec.autoHealAt) {
          toHeal.push(rec);
          return { ...rec, autoHealScheduled: false, autoHealAt: null };
        }
        return rec;
      }));
      toHeal.forEach((rec) => {
        logMsg(`Auto-healing dk=${rec.dedupKey} (${rec.serviceName})`, "info");
        resolveIncident(rec);
      });
      autoHealTickerRef.current = setTimeout(tick, 1000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(autoHealTickerRef.current);
    };
  }, [autoHealConfig]);

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
      const res = await throttledFetch(url.toString(), { headers: apiHeaders });
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
      const res = await throttledFetch(`/proxy/incidents/${id}/notes`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ note: { content } }) });
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
      const res = await throttledFetch(`/proxy/incidents/${id}/responder_requests`, { method: "POST", headers: apiHeaders, body: JSON.stringify(body) });
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
      if (Math.random() < noteProbability) { addNote(rec, randomNote(rec)); }
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

  async function start() {
    if (!globalRoutingKey) return logMsg("Provide the Global Routing Key", "warn");
    if (!apiToken) logMsg("Tip: Provide a REST API token + From email to enable notes/responders & ID mapping", "warn");
    campaignRef.current = [];
    let serviceSnapshot = services;
    if (!serviceSnapshot.length) {
      logMsg("No services loaded. Attempting to load now...", "warn");
      const loaded = await fetchAllServices();
      serviceSnapshot = loaded || services;
    }
    const included = serviceSnapshot.filter((s) => s.include);
    if (!included.length) return logMsg("Include at least one service", "warn");
    if (resumeExistingEnabled) {
      await resumeExistingIncidents(serviceSnapshot);
    }
    setIsRunning(true);
    const templateLabel = activeTemplate?.name || null;
    const profileLabel = activeProfile?.name || null;
    setLastRunTemplateName(templateLabel);
    if (profileLabel && templateLabel) {
      logMsg(`Simulation started (profile: ${profileLabel}, template: ${templateLabel})`);
    } else if (profileLabel) {
      logMsg(`Simulation started (profile: ${profileLabel})`);
    } else if (templateLabel) {
      logMsg(`Simulation started (template: ${templateLabel})`);
    } else {
      logMsg("Simulation started");
    }
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
      if (monitorSeverityFilter !== 'all' && rec.severity !== monitorSeverityFilter) return false;
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
    critical: 'bg-red-600 text-white',
    error: 'bg-orange-500 text-white',
    warning: 'bg-amber-300 text-gray-900',
    info: 'bg-sky-500 text-white',
  }), []);
  const selectObservabilityTemplate = React.useCallback(() => {
    const entries = OBS_SOURCE_TEMPLATES.map((tpl) => ({
      tpl,
      weight: Math.max(0, Number(sourceMix[tpl.id]) || 0),
    }));
    let total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) {
      entries.forEach((entry) => { entry.weight = 1; });
      total = entries.length;
    }
    let roll = Math.random() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.tpl;
    }
    return entries[entries.length - 1].tpl;
  }, [sourceMix]);
  const popCampaignService = React.useCallback(() => {
    const now = Date.now();
    const remaining = [];
    let selection = null;
    campaignRef.current.forEach((campaign) => {
      if (campaign.expiresAt <= now || campaign.pending.size === 0) {
        return;
      }
      if (!selection) {
        const iterator = campaign.pending.values().next();
        if (!iterator.done) {
          const targetId = iterator.value;
          const svc = services.find((s) => s.id === targetId && s.include);
          if (svc) {
            campaign.pending.delete(targetId);
            selection = { svc, metadata: { id: campaign.id, summary: campaign.summary } };
          }
        }
      }
      if (campaign.pending.size > 0) {
        remaining.push(campaign);
      }
    });
    campaignRef.current = remaining;
    return selection;
  }, [services]);
  const startCampaignForService = React.useCallback((svc) => {
    if (!campaignConfig.enabled) return null;
    const probability = Math.max(0, Math.min(1, Number(campaignConfig.probability) || 0));
    if (Math.random() >= probability) return null;
    const primaryTeam = Array.isArray(svc?.teams) ? svc.teams[0] : null;
    if (!primaryTeam?.id) return null;
    const siblings = services.filter((s) => s.id !== svc.id && s.include && Array.isArray(s.teams) && s.teams.some((t) => t.id === primaryTeam.id)).map((s) => s.id);
    if (!siblings.length) return null;
    const desired = Math.min(Math.max(1, campaignConfig.maxRelated || 1), siblings.length);
    const pendingIds = new Set(shuffleArray(siblings).slice(0, desired));
    if (!pendingIds.size) return null;
    const summary = randomFailureSummary(primaryTeam.name);
    const expiresAt = Date.now() + Math.max(30, Number(campaignConfig.windowSec) || 300) * 1000;
    const campaign = { id: generateId("cmp"), teamId: primaryTeam.id, summary, pending: pendingIds, expiresAt };
    campaignRef.current = [...campaignRef.current, campaign];
    const metadata = { id: campaign.id, summary };
    triggerCampaignChangeEvents(primaryTeam, metadata, svc);
    return metadata;
  }, [campaignConfig, services, randomFailureSummary, triggerCampaignChangeEvents]);
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Active Profile</label>
                <select
                  value={activeProfileId || ''}
                  onChange={(e) => handleSelectProfile(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {profiles.length === 0 && <option value="">No profiles</option>}
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name || 'Untitled profile'}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleCreateProfile} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded">
                New Profile
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Profile Name</label>
                <input
                  value={profileNameInput}
                  onChange={(e) => {
                    setProfileNameInput(e.target.value);
                    if (profileError) setProfileError(null);
                  }}
                  placeholder="Customer Warmup"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  value={profileDescriptionInput}
                  onChange={(e) => setProfileDescriptionInput(e.target.value)}
                  placeholder="Short note for presenters"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSaveProfile} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded">
                Save
              </button>
              <button onClick={handleSaveAsProfile} className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded">
                Save As
              </button>
              <button onClick={handleDeleteProfile} disabled={profiles.length <= 1} className={`px-3 py-2 rounded ${profiles.length <= 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                Delete
              </button>
            </div>
            {profileMigrationBanner && (
              <div className="flex items-center justify-between gap-3 rounded bg-indigo-50 text-indigo-800 px-3 py-2 text-sm">
                <p>Legacy settings migrated into a Default Profile. Rename or save new profiles as needed.</p>
                <button onClick={() => setProfileMigrationBanner(false)} className="text-indigo-800 underline">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </section>
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
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Template Library</h2>
              <p className="text-sm text-gray-600">Save and load configuration presets locally (tokens and routing keys are excluded).</p>
            </div>
            {activeTemplate ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                Active template: {activeTemplate.name}
              </span>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">No active template</span>
            )}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Template Name
              <input
                value={templateNameInput}
                onChange={(e) => {
                  setTemplateNameInput(e.target.value);
                  if (templateError) setTemplateError(null);
                }}
                placeholder="Customer warm-up run"
                className="mt-1 w-full rounded border px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Description (optional)
              <input
                value={templateDescriptionInput}
                onChange={(e) => setTemplateDescriptionInput(e.target.value)}
                placeholder="Notes about teams, services, or goals"
                className="mt-1 w-full rounded border px-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleSaveTemplate} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
              Save Template
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplateNameInput("");
                setTemplateDescriptionInput("");
                setTemplateError(null);
              }}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Clear Form
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">Templates are stored in this browser&apos;s localStorage; REST API tokens and routing keys are never persisted.</p>
          {templateError && <p className="mt-2 text-sm text-rose-600">{templateError}</p>}
          <div className="mt-4 divide-y divide-gray-200 rounded border border-gray-200">
            {templates.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Save your first template to populate the library.</p>
            ) : (
              templates.map((tpl) => {
                const settings = tpl.settings || {};
                const autoHealSummary = settings.autoHealConfig?.enabled
                  ? `${Math.round((settings.autoHealConfig.warningProbability || 0) * 100)}% warnings · ${settings.autoHealConfig.minDelaySec || 0}-${settings.autoHealConfig.maxDelaySec || 0}s`
                  : "Disabled";
                const campaignSummary = settings.campaignConfig?.enabled
                  ? `${Math.round((settings.campaignConfig.probability || 0) * 100)}% chance · max ${settings.campaignConfig.maxRelated || 1}`
                  : "Disabled";
                const resumeSummary = settings.resumeExistingEnabled ? "Enabled" : "Disabled";
                const changeSummary = settings.changeEventsEnabled ? "Enabled" : "Disabled";
                const updatedLabel = tpl.updatedAt ? new Date(tpl.updatedAt).toLocaleString() : "Unknown";
                return (
                  <div key={tpl.id} className={`flex flex-col gap-2 p-3 ${tpl.id === activeTemplateId ? 'bg-indigo-50' : 'bg-white'}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{tpl.name}</p>
                        {tpl.description && <p className="text-sm text-gray-600">{tpl.description}</p>}
                        <p className="text-xs text-gray-500">Updated {updatedLabel}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <button type="button" onClick={() => handleApplyTemplate(tpl.id)} className="rounded border border-indigo-500 px-3 py-1 text-indigo-600 hover:bg-indigo-50">
                          Load
                        </button>
                        <button type="button" onClick={() => handleOverwriteTemplate(tpl.id)} className="rounded border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-50">
                          Overwrite
                        </button>
                        <button type="button" onClick={() => handleDeleteTemplate(tpl.id)} className="rounded border border-rose-200 px-3 py-1 text-rose-600 hover:bg-rose-50">
                          Delete
                        </button>
                      </div>
                    </div>
                    <dl className="grid grid-cols-1 gap-3 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-gray-500">Rate</dt>
                        <dd>{settings.ratePerMinute != null ? `${settings.ratePerMinute}/min` : '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-gray-500">Auto-Heal</dt>
                        <dd>{autoHealSummary}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-gray-500">Resume</dt>
                        <dd>{resumeSummary}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-gray-500">Campaigns</dt>
                        <dd>{campaignSummary}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-gray-500">Change Events</dt>
                        <dd>{changeSummary}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })
            )}
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
          <h2 className="text-lg font-semibold mb-3">Auto-Heal Events</h2>
          <p className="text-sm text-gray-600 mb-4">
            Auto-heal sends an OK event for a subset of warning incidents after a short delay so you can demonstrate auto-pause flows.
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={!!autoHealConfig.enabled}
                onChange={(e) => setAutoHealConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable auto-heal for warnings
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                % of warnings
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(Number(autoHealConfig.warningProbability || 0) * 100)}
                  onChange={(e) => {
                    const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setAutoHealConfig((prev) => ({ ...prev, warningProbability: pct / 100 }));
                  }}
                  className="w-24 border rounded px-2 py-1 ml-2"
                />
              </label>
              <label className="text-sm">
                Min delay (sec)
                <input
                  type="number"
                  min={5}
                  value={autoHealConfig.minDelaySec}
                  onChange={(e) => setAutoHealConfig((prev) => ({ ...prev, minDelaySec: Math.max(0, Number(e.target.value) || 0) }))}
                  className="w-24 border rounded px-2 py-1 ml-2"
                />
              </label>
              <label className="text-sm">
                Max delay (sec)
                <input
                  type="number"
                  min={5}
                  value={autoHealConfig.maxDelaySec}
                  onChange={(e) => setAutoHealConfig((prev) => ({ ...prev, maxDelaySec: Math.max(0, Number(e.target.value) || 0) }))}
                  className="w-24 border rounded px-2 py-1 ml-2"
                />
              </label>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Defaults: 20% of warning incidents auto-heal between 30–90 seconds. Delays are randomized per incident.
          </p>
        </section>

        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Observability Payload Mix</h2>
          <p className="text-sm text-gray-600 mb-4">
            Tune how frequently incidents resemble each observability source. Values are normalized automatically.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {OBS_SOURCE_TEMPLATES.map((tpl) => {
              const pct = Math.round((Number(sourceMix[tpl.id]) || 0) * 100);
              return (
                <label key={tpl.id} className="text-sm font-semibold">
                  {tpl.label}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pct}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setSourceMix((prev) => ({ ...prev, [tpl.id]: val / 100 }));
                    }}
                    className="mt-1 w-full border rounded px-2 py-1"
                  />
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">Examples: CloudWatch Alarms, Datadog Monitors, New Relic APM, Splunk log searches.</p>
        </section>

        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Failure Campaigns</h2>
          <p className="text-sm text-gray-600 mb-3">
            Simulate cascading failures across services in the same team by sharing a failure ID/summary.
          </p>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={!!campaignConfig.enabled}
                onChange={(e) => setCampaignConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable correlated incident campaigns
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm">
                Trigger chance (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round((Number(campaignConfig.probability) || 0) * 100)}
                  onChange={(e) => {
                    const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setCampaignConfig((prev) => ({ ...prev, probability: pct / 100 }));
                  }}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
              <label className="text-sm">
                Max related services
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={campaignConfig.maxRelated}
                  onChange={(e) => setCampaignConfig((prev) => ({ ...prev, maxRelated: Math.max(1, Number(e.target.value) || 1) }))}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
              <label className="text-sm">
                Window (sec)
                <input
                  type="number"
                  min={30}
                  value={campaignConfig.windowSec}
                  onChange={(e) => setCampaignConfig((prev) => ({ ...prev, windowSec: Math.max(30, Number(e.target.value) || 30) }))}
                  className="mt-1 w-full border rounded px-2 py-1"
                />
              </label>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Correlated incidents show a badge in Monitor with the shared failure summary.</p>
          <div className="mt-3 border-t pt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={changeEventsEnabled}
                onChange={(e) => {
                  changeEventsToggleTouchedRef.current = true;
                  setChangeEventsEnabled(e.target.checked);
                }}
                disabled={!hasChangeCoverage}
              />
              Emit related change events
            </label>
            <p className="text-xs text-gray-500">
              {hasChangeCoverage
                ? `${changeCoverage.includedWithChange}/${changeCoverage.included || 0} included services have change integrations (${changeIntegrationStats.withChange} total)`
                : "No selected services have change integrations; load services to refresh coverage."}
            </p>
            {changeCoverageSummary && (
              <p className="text-xs text-gray-500">Teams with coverage: {changeCoverageSummary}</p>
            )}
            {lastChangeEvent && (
              <p className="text-xs text-green-700">
                Last change event ({new Date(lastChangeEvent.ts).toLocaleTimeString()}): {lastChangeEvent.serviceName} — {lastChangeEvent.failureSummary}
              </p>
            )}
          </div>
        </section>

        <section className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Startup & Resume</h2>
          <p className="text-sm text-gray-600 mb-3">
            When enabled, the simulator pulls any triggered/acknowledged incidents from PagerDuty for the services you&rsquo;ve included before starting a new run.
          </p>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={resumeExistingEnabled}
              onChange={(e) => setResumeExistingEnabled(e.target.checked)}
            />
            Resume existing PagerDuty incidents when starting
          </label>
          <p className="text-xs text-gray-500 mt-2">Requires a REST API token; incidents appear with a “Synced” badge in the Monitor table.</p>
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
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">Current Load</h2>
                <p className="text-sm text-gray-500">
                  Last run template:&nbsp;
                  {lastRunTemplateName ? (
                    <span className="font-semibold text-gray-700">{lastRunTemplateName}</span>
                  ) : (
                    <span className="font-semibold text-gray-700">Manual configuration</span>
                  )}
                </p>
              </div>
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
                        <option value="error">Error</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info</option>
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
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-200" aria-hidden="true" />
                    Auto-heal queued
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
                          <th className="py-2 pr-4">Source</th>
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
                          const autoHealPending = rec.autoHealScheduled && rec.autoHealAt && rec.autoHealAt > now;
                          const autoHealCountdown = autoHealPending ? Math.max(0, Math.ceil((rec.autoHealAt - now) / 1000)) : null;
                          const rowClass = `border-b last:border-0 transition-colors ${
                            mappingStalled ? 'bg-rose-50' : responderPending ? 'bg-amber-50' : autoHealPending ? 'bg-emerald-50' : ''
                          }`;
                          const severityShade = severityTone[rec.severity] || 'bg-gray-500';
                          const acked = rec.acked;
                          return (
                            <tr key={rec.dedupKey} className={rowClass}>
                              <td className="py-3 pl-4 pr-4 align-top">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-gray-900">{rec.serviceName}</span>
                                  {rec.failureSummary && (
                                    <span className="text-xs text-rose-700">Failure: {rec.failureSummary}</span>
                                  )}
                                  <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide">
                                    {mappingStalled && (
                                      <span className="rounded bg-rose-200 px-1.5 py-0.5 text-rose-800">Mapping stalled</span>
                                    )}
                                    {responderPending && (
                                      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-800">Responder pending</span>
                                    )}
                                    {autoHealPending && (
                                      <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-emerald-900">
                                        Auto-heal in {formatSeconds(autoHealCountdown)}
                                      </span>
                                    )}
                                    {rec.syncedFromPd && (
                                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-800">Synced</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-4 align-top">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white ${severityShade}`}>
                                  {rec.severity}
                                </span>
                              </td>
                              <td className="py-3 pr-4 align-top text-xs text-gray-600">{rec.observabilitySource || 'Simulated'}</td>
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
                          <button onClick={() => addNote(rec, randomNote(rec))} className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">Add Note</button>
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
  const takeRestToken = React.useCallback(() => {
    const limiter = restLimiterRef.current;
    const now = Date.now();
    const elapsed = (now - limiter.lastRefill) / 1000;
    if (elapsed > 0) {
      limiter.tokens = Math.min(limiter.capacity, limiter.tokens + elapsed * limiter.refillRatePerSec);
      limiter.lastRefill = now;
    }
    if (limiter.tokens >= 1) {
      limiter.tokens -= 1;
      return true;
    }
    return false;
  }, []);
