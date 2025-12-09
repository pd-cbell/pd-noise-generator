import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Taxonomy...');

  // 1. Create Domain
  const domain = await prisma.domain.upsert({
    where: { name: 'Retail Banking' },
    update: {},
    create: {
      name: 'Retail Banking',
    },
  });
  console.log(`- Domain created: ${domain.name}`);

  // 2. Create Team
  const team = await prisma.team.create({
    data: {
      name: 'Checkout Team',
      persona: 'Overworked & Anxious',
      domainId: domain.id,
    },
  });
  console.log(`- Team created: ${team.name}`);

  // 3. Create Service
  const service = await prisma.service.create({
    data: {
      name: 'Payment Gateway',
      teamId: team.id,
      integrationKey: 'FAKE_ROUTING_KEY_123',
    },
  });
  console.log(`- Service created: ${service.name}`);

  // 4. Create Template (with Faker tokens)
  const templateStr = JSON.stringify({
    summary: "Payment Failed: {{faker.finance.currencyCode}} transaction declined",
    source: "payment-gateway-{{faker.string.alpha(3)}}",
    severity: "error",
    custom_details: {
      transaction_id: "{{faker.string.uuid}}",
      amount: "{{faker.finance.amount}}",
      customer_ip: "{{faker.internet.ip}}",
      error_code: "ERR_{{faker.number.int}}"
    }
  }, null, 2);

  const payload = await prisma.payloadTemplate.create({
    data: {
      name: 'Declined Transaction',
      description: 'Simulates a payment decline with random amounts',
      template: templateStr,
      serviceId: service.id,
      isDraft: false
    },
  });
  console.log(`- Template created: ${payload.name}`);

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
