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
