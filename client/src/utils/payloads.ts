// Helper functions copied from original App.jsx
function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function randomSummary(serviceName: string): string {
  const verbs = ["Spike","Timeout","Error","Degradation","Saturation","Anomaly","Failure","High latency"];
  const comps = ["DB","Cache","API","Queue","Worker","Gateway","Search","Billing"];
  return `${randomFrom(verbs)} in ${randomFrom(comps)} for ${serviceName}`;
}

function randomSource(): string { const hosts = ["web-01","web-02","api-01","worker-05","edge-03","cron-02","db-01"]; return randomFrom(hosts) + ".corp"; }

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

function randomFailureSummary(teamName: string | undefined): string {
  const base = randomFrom(FAILURE_NARRATIVES);
  return teamName ? `${base} (${teamName})` : base;
}

// --- Payload Registry Types ---
export interface PayloadAdapter {
  id: string;
  label: string;
  group?: string;
  mixKey?: string;
  hidden?: boolean;
  supportsCampaigns?: boolean;
  defaultWeight?: number;
  metrics?: string[]; // For CloudWatch
  regions?: string[]; // For CloudWatch
  build: (service: any, failureMeta?: any) => any; // Need more specific types for service/failureMeta later
}

export interface CampaignItem {
  id: string;
  payloadString: string;
  eventAction: string;
  eventType: string;
  dedupKey: string | null;
  delaySeconds: number;
  times: number;
  intervalSeconds: number;
}

export interface ImportedCampaign {
  id: string;
  name: string;
  description: string;
  source: string;
  items: CampaignItem[];
}

// --- Payload Registry Implementation ---
export function createPayloadRegistry() {
  const adapters: PayloadAdapter[] = [];
  const map = new Map<string, PayloadAdapter>();
  const listeners = new Set<(adapters: PayloadAdapter[]) => void>();

  const notify = () => {
    const snapshot = adapters.slice();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("Payload registry listener failed", err);
      }
    });
  };

  return {
    register(definition: PayloadAdapter) {
      if (!definition?.id) throw new Error("Payload adapter id required");
      const mixKey = definition.mixKey || definition.id;
      const adapter: PayloadAdapter = { ...definition, mixKey };
      const idx = adapters.findIndex((tpl) => tpl.id === adapter.id);
      if (idx >= 0) {
        adapters[idx] = adapter;
      } else {
        adapters.push(adapter);
      }
      map.set(adapter.id, adapter);
      notify();
      return adapter;
    },
    list(filterFn?: (adapter: PayloadAdapter) => boolean) {
      const snapshot = adapters.slice();
      return typeof filterFn === "function" ? snapshot.filter(filterFn) : snapshot;
    },
    get(id: string) {
      return map.get(id) || null;
    },
    pickByMix(mix: Record<string, number> = {}) {
      const candidates = adapters.filter((adapter) => adapter.group === 'observability' && typeof adapter.build === 'function' && !adapter.hidden);
      if (!candidates.length) return null;
      let total = 0;
      const weighted = candidates.map((adapter) => {
        const key = adapter.mixKey || adapter.id;
        const weight = Number(mix?.[key]) || adapter.defaultWeight || 0;
        total += weight;
        return { adapter, weight };
      });
      if (total <= 0) {
        return randomFrom(candidates);
      }
      let roll = Math.random() * total;
      for (const entry of weighted) {
        roll -= entry.weight;
        if (roll <= 0) return entry.adapter;
      }
      return candidates[candidates.length - 1];
    },
    subscribe(listener: (adapters: PayloadAdapter[]) => void) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      listener(adapters.slice());
      return () => listeners.delete(listener);
    },
  };
}

export function createPayloadGenerator(registry: ReturnType<typeof createPayloadRegistry>) {
  const fallbackTemplate: PayloadAdapter = {
    id: "fallback",
    label: "Synthetic Telemetry",
    group: "observability",
    mixKey: "fallback",
    hidden: true,
    supportsCampaigns: true,
    build(service, failureMeta) {
      return {
        summary: randomSummary(service?.name || "Unknown service"),
        source: randomSource(),
        component: service?.name,
        custom_details: {
          service_name: service?.name,
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        noteTemplates: NOTE_LIBRARY.general,
      };
    },
  };
  registry.register(fallbackTemplate);
  return {
    selectTemplate(sourceMix: Record<string, number>, preferredId?: string) {
      if (preferredId) {
        const adapter = registry.get(preferredId);
        if (adapter) return adapter;
      }
      return registry.pickByMix(sourceMix) || fallbackTemplate;
    },
    buildEvent({ service, failure, sourceMix, preferredTemplateId }: { service: any; failure?: any; sourceMix: Record<string, number>; preferredTemplateId?: string }) {
      const template = this.selectTemplate(sourceMix, preferredTemplateId);
      const payload = template?.build?.(service, failure) || fallbackTemplate.build(service, failure);
      return { template, payload };
    },
  };
}

// --- Built-in Payload Adapters (from App.jsx) ---
const BUILTIN_PAYLOAD_ADAPTERS: PayloadAdapter[] = [
  {
    id: "cloudwatch",
    label: "AWS CloudWatch Alarm",
    group: "observability",
    mixKey: "cloudwatch",
    uiMixOption: true,
    supportsCampaigns: true,
    defaultWeight: 0.25,
    metrics: ["CPUUtilization", "RequestLatency", "Throttles", "HTTP5xx", "HealthyHostCount"],
    regions: ["us-east-1", "us-west-2", "eu-west-1"],
    build(svc, failureMeta) {
      const metric = randomFrom(this.metrics as string[]);
      const region = randomFrom(this.regions as string[]);
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
    group: "observability",
    mixKey: "datadog",
    uiMixOption: true,
    supportsCampaigns: true,
    defaultWeight: 0.25,
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
    group: "observability",
    mixKey: "newrelic",
    uiMixOption: true,
    supportsCampaigns: true,
    defaultWeight: 0.25,
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
    label: "Splunk Log Search",
    group: "observability",
    mixKey: "splunk",
    uiMixOption: true,
    supportsCampaigns: true,
    defaultWeight: 0.25,
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

export async function loadImportedCampaignBundles(manifestUrl = '/templates/index.json'): Promise<ImportedCampaign[]> {
  let templateUrls: string[] = [];
  try {
    const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      if (Array.isArray(manifest?.files)) {
        templateUrls = manifest.files.filter((file: any) => typeof file === 'string');
      }
    }
  } catch (err: any) {
    console.warn('Imported campaign manifest unavailable:', err?.message || err);
  }

  // Fallback to payload_import.ms.json if manifest is empty or fails
  if (!templateUrls.length) {
    templateUrls = ['/templates/payload_import.ms.json'];
  }

  const bundles: ImportedCampaign[] = [];
  for (const url of templateUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      const parsed = await res.json();
      const groups = Array.isArray(parsed) ? parsed : [];
      groups.forEach((entry: any, groupIdx: number) => {
        const group = entry.event_group || entry;
        const items = Array.isArray(group?.event_group_items) ? group.event_group_items : [];
        if (!items.length) return;
        const id = `import_${group.hash_id || `${groupIdx}_${bundles.length}`}`;
        bundles.push({
          id,
          name: group?.name || `Imported Campaign ${bundles.length + 1}`,
          description: group?.description || entry?.name || 'Imported payload campaign',
          source: url,
          items: items.map((item: any, itemIdx: number) => ({
            id: `${id}_step_${itemIdx}`,
            payloadString: item.payload,
            eventAction: item.event_action || 'trigger',
            eventType: item.event_type || 'alert',
            dedupKey: item.dedup_key || null,
            delaySeconds: Number(item.delay_seconds) || 0,
            times: Number(item.times) || 1,
            intervalSeconds: Number(item.interval_seconds) || 0,
          })),
        });
      });
    } catch (err: any) {
      console.warn('Imported campaign load failed:', err?.message || err);
    }
  }
  return bundles;
}

export const payloadRegistry = createPayloadRegistry();
BUILTIN_PAYLOAD_ADAPTERS.forEach((adapter) => payloadRegistry.register(adapter));
export const payloadGenerator = createPayloadGenerator(payloadRegistry);
