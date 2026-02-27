import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma';
import { GoldenDemoService } from '../services/GoldenDemoService';
import { AgentService } from '../services/AgentService';
import { Role } from '@prisma/client';

type Provider = 'openai' | 'google';

type HarnessCase = {
  id: string;
  prompt: string;
  industry: string;
  useCase: string;
  eventCount: number;
  changeCount: number;
};

type HarnessResult = {
  caseId: string;
  provider: Provider;
  ok: boolean;
  error?: string;
  proposalLength?: number;
  eventCount?: number;
  changeCount?: number;
  beatsCount?: number;
  missingServiceNameCount?: number;
  sparseCustomDetailsCount?: number;
  qualityPass?: boolean;
  qualityFailures?: string[];
  outputFile?: string;
};

const HARNESS_CASES: HarnessCase[] = [
  {
    id: 'cx-qa-latency',
    prompt:
      'API response delays in Profile API degrade CX QA agent response quality during peak support hours. Include a routine deploy and escalation.',
    industry: 'Financial Services',
    useCase: 'Agent Ops',
    eventCount: 10,
    changeCount: 2,
  },
  {
    id: 'security-routing',
    prompt:
      'Suspicious authentication spikes trigger security workflow confusion across identity services and SOC dashboards. Show context-rich triage.',
    industry: 'Tech & Telco',
    useCase: 'Security Incident Management',
    eventCount: 9,
    changeCount: 1,
  },
  {
    id: 'dora-regression',
    prompt:
      'A deployment automation regression increases incident volume and slows recovery. Emphasize remediation and measurable operational learning.',
    industry: 'Public Sector',
    useCase: 'DORA Compliance',
    eventCount: 8,
    changeCount: 2,
  },
];

const QUALITY_THRESHOLDS = {
  minBeats: 3,
  maxMissingServiceNameCount: 0,
  maxSparseCustomDetailsRatio: 0.4,
  minChangeEvents: 1,
} as const;

function toServiceContext(services: Array<{ name: string; integrationKey: string | null; changeIntegrationKey: string | null }>) {
  return services.map((svc) => ({
    name: svc.name,
    integrationKey: svc.integrationKey || undefined,
    changeIntegrations: svc.changeIntegrationKey ? [{ integrationKey: svc.changeIntegrationKey }] : [],
  }));
}

function summarizeGoldenDemo(goldenDemo: any) {
  const items = Array.isArray(goldenDemo?.configJson?.items) ? goldenDemo.configJson.items : [];
  const beats = Array.isArray(goldenDemo?.configJson?.beats) ? goldenDemo.configJson.beats : [];
  const missingServiceNameCount = items.filter(
    (item: any) => !item?.payload?.custom_details?.service_name
  ).length;
  const sparseCustomDetailsCount = items.filter((item: any) => {
    const details = item?.payload?.custom_details;
    if (!details || typeof details !== 'object') return true;
    const keys = Object.keys(details).filter((k) => k !== 'service_name');
    return keys.length < 2;
  }).length;
  return {
    eventCount: items.length,
    changeCount: items.filter((item: any) => item?.eventType === 'change').length,
    beatsCount: beats.length,
    missingServiceNameCount,
    sparseCustomDetailsCount,
  };
}

function evaluateQuality(summary: {
  eventCount: number;
  changeCount: number;
  beatsCount: number;
  missingServiceNameCount: number;
  sparseCustomDetailsCount: number;
}) {
  const failures: string[] = [];
  if (summary.beatsCount < QUALITY_THRESHOLDS.minBeats) {
    failures.push(`beatsCount ${summary.beatsCount} < ${QUALITY_THRESHOLDS.minBeats}`);
  }
  if (summary.missingServiceNameCount > QUALITY_THRESHOLDS.maxMissingServiceNameCount) {
    failures.push(
      `missingServiceNameCount ${summary.missingServiceNameCount} > ${QUALITY_THRESHOLDS.maxMissingServiceNameCount}`
    );
  }
  if (summary.changeCount < QUALITY_THRESHOLDS.minChangeEvents) {
    failures.push(`changeCount ${summary.changeCount} < ${QUALITY_THRESHOLDS.minChangeEvents}`);
  }
  const sparseRatio = summary.eventCount > 0 ? summary.sparseCustomDetailsCount / summary.eventCount : 1;
  if (sparseRatio > QUALITY_THRESHOLDS.maxSparseCustomDetailsRatio) {
    failures.push(
      `sparseCustomDetailsRatio ${sparseRatio.toFixed(2)} > ${QUALITY_THRESHOLDS.maxSparseCustomDetailsRatio}`
    );
  }
  return {
    qualityPass: failures.length === 0,
    qualityFailures: failures,
  };
}

async function run() {
  const goldenDemoService = new GoldenDemoService();
  const agentService = new AgentService(goldenDemoService);

  const user = await prisma.user.findFirst({
    where: { role: { in: [Role.ADMIN, Role.EDITOR] } },
    select: { id: true, role: true },
  });
  if (!user) {
    throw new Error('No ADMIN/EDITOR user found. Create/login a user before running provider harness.');
  }

  const services = await prisma.service.findMany({
    take: 8,
    select: { name: true, integrationKey: true, changeIntegrationKey: true },
  });
  if (services.length === 0) {
    throw new Error('No services found in DB. Load domain config/services before running provider harness.');
  }

  const serviceContext = toServiceContext(services);
  const outDir = path.resolve(process.cwd(), '../docs/fixtures/provider-harness');
  fs.mkdirSync(outDir, { recursive: true });

  const results: HarnessResult[] = [];
  const providers: Provider[] = ['openai', 'google'];

  for (const testCase of HARNESS_CASES) {
    for (const provider of providers) {
      const startedAt = new Date().toISOString();
      console.log(`[harness] starting ${testCase.id} (${provider})`);
      try {
        const proposal = await agentService.generateProposal({
          prompt: testCase.prompt,
          provider,
          services: serviceContext,
          industry: testCase.industry,
          useCase: testCase.useCase,
        });

        const demo = await agentService.buildCampaign({
          prompt: testCase.prompt,
          approvedPlan: proposal,
          provider,
          services: serviceContext,
          eventCount: testCase.eventCount,
          changeCount: testCase.changeCount,
          goldenDemoName: `HARNESS-${provider}-${testCase.id}-${Date.now()}`,
          industry: testCase.industry,
          useCase: testCase.useCase,
          narrative: proposal,
          personaNotes: `Provider harness run for ${provider}/${testCase.id}`,
          createdByUserId: user.id,
          role: user.role,
        });

        const summary = summarizeGoldenDemo(demo);
        const quality = evaluateQuality(summary);
        const out = {
          startedAt,
          completedAt: new Date().toISOString(),
          provider,
          case: testCase,
          proposal,
          goldenDemo: demo,
          summary,
          quality,
        };
        const outFile = path.join(outDir, `${testCase.id}.${provider}.json`);
        fs.writeFileSync(outFile, JSON.stringify(out, null, 2));

        // Keep DB clean after harness runs.
        await prisma.goldenDemo.delete({ where: { id: demo.id } });

        console.log(`[harness] completed ${testCase.id} (${provider})`);

        results.push({
          caseId: testCase.id,
          provider,
          ok: true,
          proposalLength: proposal.length,
          ...summary,
          ...quality,
          outputFile: outFile,
        });
      } catch (error: any) {
        console.log(`[harness] failed ${testCase.id} (${provider}) -> ${error?.message || String(error)}`);
        results.push({
          caseId: testCase.id,
          provider,
          ok: false,
          error: error?.message || String(error),
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: QUALITY_THRESHOLDS,
    serviceCountUsed: serviceContext.length,
    results,
  };
  const reportFile = path.join(outDir, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log('Provider harness completed.');
  console.log(`Report: ${reportFile}`);
  results.forEach((r) => {
    if (!r.ok) {
      console.log(`✗ ${r.caseId} (${r.provider}): ${r.error}`);
      return;
    }
    const verdict = r.qualityPass ? 'PASS' : 'FAIL';
    const reason = r.qualityPass ? '' : ` issues=[${(r.qualityFailures || []).join('; ')}]`;
    console.log(
      `✓ ${r.caseId} (${r.provider}) ${verdict} events=${r.eventCount} changes=${r.changeCount} beats=${r.beatsCount} sparse=${r.sparseCustomDetailsCount} missingSvc=${r.missingServiceNameCount}${reason}`
    );
  });
}

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Provider harness failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
