export const GOLDEN_DEMO_USE_CASE_OPTIONS = [
  'Agent Ops',
  'Security Incident Management',
  'Data Ops',
  'DORA Compliance',
  'LLM Ops',
  'Crisis Ops',
] as const;

export const GOLDEN_DEMO_INDUSTRY_OPTIONS = [
  'Financial Services',
  'Public Sector',
  'Travel & Hospitality',
  'Tech & Telco',
  'Retail',
  'Media & Entertainment',
] as const;

export type GoldenDemoUseCase = (typeof GOLDEN_DEMO_USE_CASE_OPTIONS)[number];
export type GoldenDemoIndustry = (typeof GOLDEN_DEMO_INDUSTRY_OPTIONS)[number];

export function hasGoldenDemoTaxonomy(demo: { industry?: string | null; useCase?: string | null }) {
  return Boolean(demo.industry && demo.useCase);
}

const QUALITY_THRESHOLDS = {
  minBeats: 3,
  maxMissingServiceNameCount: 0,
  maxSparseCustomDetailsRatio: 0.4,
  minChangeEvents: 1,
} as const;

type DiagnosticsLike = {
  eventCount?: number;
  changeCount?: number;
  beatsCount?: number;
  missingServiceNameCount?: number;
  sparseCustomDetailsCount?: number;
};

export function getGoldenDemoQualityVerdict(demo: {
  configJson?: { generationDiagnostics?: DiagnosticsLike };
}) {
  const diagnostics = demo.configJson?.generationDiagnostics;
  if (!diagnostics) {
    return { status: 'unscored' as const, issues: ['No generation diagnostics available'] };
  }

  const events = diagnostics.eventCount ?? 0;
  const changes = diagnostics.changeCount ?? 0;
  const beats = diagnostics.beatsCount ?? 0;
  const missingSvc = diagnostics.missingServiceNameCount ?? 0;
  const sparse = diagnostics.sparseCustomDetailsCount ?? 0;
  const sparseRatio = events > 0 ? sparse / events : 1;

  const issues: string[] = [];
  if (beats < QUALITY_THRESHOLDS.minBeats) {
    issues.push(`Beats below threshold (${beats}/${QUALITY_THRESHOLDS.minBeats})`);
  }
  if (changes < QUALITY_THRESHOLDS.minChangeEvents) {
    issues.push(`Change events below threshold (${changes}/${QUALITY_THRESHOLDS.minChangeEvents})`);
  }
  if (missingSvc > QUALITY_THRESHOLDS.maxMissingServiceNameCount) {
    issues.push(`Missing service_name fields (${missingSvc})`);
  }
  if (sparseRatio > QUALITY_THRESHOLDS.maxSparseCustomDetailsRatio) {
    issues.push(`Sparse custom details ratio high (${sparseRatio.toFixed(2)})`);
  }

  return {
    status: issues.length === 0 ? ('pass' as const) : ('warn' as const),
    issues,
  };
}
