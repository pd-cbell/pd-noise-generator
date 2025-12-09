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
  uiMixOption?: boolean; // New UI flag
  metrics?: string[]; // For CloudWatch
  regions?: string[]; // For CloudWatch
  build: (service: any, failureMeta?: any) => any; // Need more specific types for service/failureMeta later
}

// --- Payload Registry Implementation ---
export function createPayloadRegistry() {
  const adapters: PayloadAdapter[] = [];
  const map = new Map<string, PayloadAdapter>();
  const listeners = new Set<(adapters: PayloadAdapter[]) => void>(); // Listeners are not used in backend, but keep interface

  const notify = () => {
    // No frontend listeners on backend
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
      // Not used in backend
      return () => {};
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

// --- Built-in Payload Adapters (Enhanced) ---
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
      const accountId = Math.floor(100000000000 + Math.random() * 900000000000);
      
      return {
        summary: `[CloudWatch] ${metric} breaching on ${svc.name}`,
        source: `cw.${region}.amazonaws.com`,
        component: svc.name,
        severity: 'critical',
        custom_details: {
          metric,
          region,
          threshold,
          observed_value: value,
          aws_account: accountId,
          namespace: "AWS/EC2",
          period: 300,
          statistic: "Average",
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        links: [
          {
            href: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:`,
            text: "View Alarm in Console"
          }
        ],
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
      const monitorId = Math.floor(Math.random() * 9000000);
      
      return {
        summary: `[Datadog] ${monitor} abnormal for ${svc.name}`,
        source: `datadoghq.com`,
        component: svc.name,
        severity: 'error',
        custom_details: {
          monitor_name: monitor,
          monitor_id: monitorId,
          status: randomFrom(["Alert", "Warn"]),
          tags: ["team:sre", `service:${svc.name}`, "env:production"],
          evaluation_window: "last_5m",
          value: (Math.random() * 10).toFixed(2),
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        links: [
          {
            href: `https://app.datadoghq.com/monitors/${monitorId}`,
            text: "View Monitor"
          },
          {
            href: `https://app.datadoghq.com/dashboard/lists`,
            text: "Related Dashboard"
          }
        ],
        images: [
          {
            src: "https://chart.googleapis.com/chart?chs=400x250&cht=lc&chd=t:10,20,30,25,40,50,45,60,70&chco=FF0000&chls=2,4,0&chxt=x,y&chg=20,20&chtt=Metric+Trend",
            href: `https://app.datadoghq.com/monitors/${monitorId}`,
            alt: "Snapshot"
          }
        ],
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
      const violationId = Math.floor(Math.random() * 500000);
      
      return {
        summary: `[NewRelic] Slow transaction ${transaction} on ${svc.name}`,
        source: "newrelic.com",
        component: transaction,
        severity: 'warning',
        custom_details: {
          transaction,
          apdex_score: (0.3 + Math.random() * 0.3).toFixed(2),
          throughput_rpm: Math.floor(Math.random() * 5000),
          violation_id: violationId,
          policy_name: "Golden Signals Policy",
          condition_name: "Response Time > 500ms",
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        links: [
          {
            href: `https://one.newrelic.com/launcher/nrai.launcher?pane=eyJuZXJkbGV0SWQiOiJhbGVydGluZy11aS1jbGFzc2ljLmluY2lkZW50cyJ9&sidebars=eyJuZXJkbGV0SWQiOiJhbGVydGluZy11aS1jbGFzc2ljLmluY2lkZW50LWRldGFpbHMiLCJpbmNpZGVudElkIjoi${violationId}In0=`,
            text: "Open in New Relic"
          }
        ],
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
      const searchId = `sid_${Math.random().toString(36).substr(2, 8)}`;
      
      return {
        summary: `[Splunk] ${signature} pattern detected in ${svc.name}`,
        source: "splunkcloud.com",
        component: svc.name,
        severity: 'error',
        custom_details: {
          signature,
          search_name: "Production Error Patterns",
          search_id: searchId,
          log_level: "ERROR",
          sample_log: `[${new Date().toISOString()}] [thread-main] ERROR com.example.${svc.name.replace(/\s+/g, '')}: ${signature}: ${svc.name} failing to reach upstream`,
          host: randomSource(),
          failure_id: failureMeta?.id,
          failure_summary: failureMeta?.summary,
        },
        links: [
          {
            href: `https://splunk.example.com/en-US/app/search/search?q=search%20index%3Dprod%20service%3D${encodeURIComponent(svc.name)}%20${signature}`,
            text: "View Search Results"
          }
        ],
        noteTemplates: [
          `Splunk saved search matched ${signature}`,
          "Investigating correlated log spikes across services",
        ],
      };
    },
  },
];

export const payloadRegistry = createPayloadRegistry();
BUILTIN_PAYLOAD_ADAPTERS.forEach((adapter) => payloadRegistry.register(adapter));
export const payloadGenerator = createPayloadGenerator(payloadRegistry);
