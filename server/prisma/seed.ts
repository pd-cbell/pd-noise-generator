import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const templatesDir = path.join(__dirname, '../../client/public/templates');
  console.log(`Reading templates from ${templatesDir}`);

  try {
    const files = await fs.readdir(templatesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');

    for (const file of jsonFiles) {
      const filePath = path.join(templatesDir, file);
      console.log(`Processing ${file}...`);
      
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Support both single object or array format (as seen in payloads.ts logic)
      const campaignGroups = Array.isArray(data) ? data : [data];

      for (const group of campaignGroups) {
        const meta = group.event_group || group;
        const items = group.event_group_items || [];

        if (!items.length) continue;

        // Check uniqueness by name to avoid dupes on re-seed
        const existing = await prisma.campaign.findFirst({
          where: { name: meta.name }
        });

        if (existing) {
          console.log(`  Campaign "${meta.name}" already exists. Skipping.`);
          continue;
        }

        await prisma.campaign.create({
          data: {
            name: meta.name,
            description: meta.description,
            source: file,
            items: {
              create: items.map((item: any, idx: number) => ({
                order: idx,
                payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload,
                eventAction: item.event_action || 'trigger',
                eventType: item.event_type || 'alert',
                dedupKey: item.dedup_key,
                delaySeconds: Number(item.delay_seconds) || 0,
                repeatCount: Number(item.times) || 1,
                intervalSeconds: Number(item.interval_seconds) || 0,
              }))
            }
          }
        });
        console.log(`  Created campaign: "${meta.name}" with ${items.length} steps.`);
      }
    }
  } catch (e) {
    console.error('Seeding failed:', e);
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
