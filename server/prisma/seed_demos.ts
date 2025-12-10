import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Golden Demos...');

  // Ensure a user exists (or use a placeholder ID if your schema allows)
  // For this seed, we'll try to find the first user or create a system user
  let user = await prisma.user.findFirst();
  if (!user) {
      user = await prisma.user.create({
          data: {
              email: 'system@example.com',
              googleId: 'system_seed_user',
              name: 'System Seeder'
          }
      });
  }

  const demos = [
    {
      name: "OrbitPay – Instant Transfer Latency Spiral",
      vertical: "FSI",
      maturityLevel: "Proactive",
      narrative: 
`### **Scenario Narrative: OrbitPay Instant Transfer Latency**

**1. Signal Complexity (The Noise):** 
It starts subtle. A few "High Latency" warnings on the payment-gateway-service. Nothing critical yet, just background noise that usually gets auto-resolved. This simulates the early onset of a degradation that is often ignored.

**2. Business Impact (The Spike):** 
Suddenly, the latency warnings spike into critical errors. The instant-transfer-api begins failing 50% of requests with 504 Gateway Timeouts. This is the "Oh no" moment where customer experience is directly impacted.

**3. Triage & Context (The Root Cause):** 
Looking at the timeline, we see a "Change Event" on the ledger-db service from 5 minutes ago: *v2.4.1 Schema Migration*. This correlates perfectly with the start of the latency.

**4. Resolution (The Fix):** 
The team executes a rollback on the ledger-db. A final Change Event confirms the rollback, and the latency alerts auto-resolve as metrics return to normal.`,
      personaNotes: "Focus on the transition from 'just noise' to 'business impact'. Use the Change Event on the ledger-db as the smoking gun.",
      createdByUserId: user.id,
      configJson: {
        name: "OrbitPay Latency",
        description: "Simulates a DB migration causing latency in payment processing.",
        beats: [
            {
                id: "beat-1",
                title: "1. The Noise Begins",
                description: "Low-severity latency alerts appear.",
                whatToShowInPagerDuty: "Alerts Table (filtered to Warning)",
                whatToSay: "Notice these latency warnings coming in. In a noisy environment, these are easily missed, but PagerDuty is aggregating them.",
                approxTimingSec: 30
            },
            {
                id: "beat-2",
                title: "2. Business Impact",
                description: "Critical 504 errors start spiking.",
                whatToShowInPagerDuty: "Service Activity or Incident Detail",
                whatToSay: "Now the latency has tipped over into full-blown failures. Customers can't transfer money. This is a P1.",
                approxTimingSec: 60
            },
            {
                id: "beat-3",
                title: "3. The Smoking Gun",
                description: "Identify the recent Change Event.",
                whatToShowInPagerDuty: "Recent Changes widget on the Incident",
                whatToSay: "Let's look for context. Right here—a schema migration on the Ledger DB happened just before the alerts started.",
                approxTimingSec: 45
            },
            {
                id: "beat-4",
                title: "4. Resolution",
                description: "Rollback and recovery.",
                whatToShowInPagerDuty: "Timeline / Resolution Note",
                whatToSay: "The team rolls back the migration. Watch as the incident auto-resolves as the telemetry recovers.",
                approxTimingSec: 30
            }
        ],
        items: [
            {
                stepName: "Initial Latency Warning",
                service: "Payment Gateway", // User needs to map this!
                delaySeconds: 0,
                repeatCount: 1,
                eventType: "alert",
                severity: "warning",
                payload: {
                    summary: "High Latency (200ms) on /transfer endpoint",
                    source: "CloudWatch",
                    custom_details: { service_name: "Payment Gateway" }
                }
            },
            {
                stepName: "Critical Failures",
                service: "Payment Gateway",
                delaySeconds: 60,
                repeatCount: 5,
                eventType: "alert",
                severity: "critical",
                payload: {
                    summary: "504 Gateway Timeout - Instant Transfer Failed",
                    source: "CloudWatch",
                    custom_details: { service_name: "Payment Gateway" }
                }
            },
            {
                stepName: "Root Cause Change",
                service: "Ledger DB",
                delaySeconds: 10,
                eventType: "change",
                payload: {
                    summary: "Deploy: Ledger DB v2.4.1 Schema Migration",
                    source: "Jenkins",
                    custom_details: { service_name: "Ledger DB" }
                }
            }
        ]
      }
    }
  ];

  for (const demo of demos) {
    // Check if exists
    const exists = await prisma.goldenDemo.findFirst({
        where: { name: demo.name, createdByUserId: user.id }
    });

    if (!exists) {
        await prisma.goldenDemo.create({ data: demo });
        console.log(`Created demo: ${demo.name}`);
    } else {
        console.log(`Demo already exists: ${demo.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
