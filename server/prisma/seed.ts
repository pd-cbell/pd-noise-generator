import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const templatesDir = path.join(__dirname, '../../client/public/templates');
  console.log(`[Seed] Reading templates from ${templatesDir}`);

  try {
    const files = await fs.readdir(templatesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');
    console.log(`[Seed] Found JSON files: ${jsonFiles.join(', ')}`);

    for (const file of jsonFiles) {
      const filePath = path.join(templatesDir, file);
      console.log(`[Seed] Processing ${filePath}...`);
      
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      const campaignGroups = Array.isArray(data) ? data : [data];
      console.log(`[Seed] Found ${campaignGroups.length} potential campaign groups in ${file}.`);

      for (const group of campaignGroups) {
        console.log(`[Seed] Current group object structure: ${JSON.stringify(group, null, 2)}`); // Log group structure
        
        const meta = group.event_group || group;
        console.log(`[Seed] Meta object structure (after event_group check): ${JSON.stringify(meta, null, 2)}`); // Log meta structure

        const items = Array.isArray(meta?.event_group_items) ? meta.event_group_items : [];
        console.log(`[Seed] meta.event_group_items: ${JSON.stringify(meta?.event_group_items, null, 2)}`); // Log raw items array from meta
        console.log(`[Seed] Items after Array.isArray check: ${items.length}`); // Log items.length
        
        if (!items.length) {
            console.log(`[Seed] Skipping campaign (no items found after parsing).`);
            continue;
        }

        const campaignName = `${meta.name} (from ${file})`; // Make name unique

        // Check uniqueness by name to avoid dupes on re-seed
        const existing = await prisma.campaign.findFirst({
          where: { name: campaignName }
        });

        if (existing) {
          console.log(`[Seed] Campaign "${campaignName}" already exists in DB (ID: ${existing.id}). Skipping.`);
          continue;
        }

        await prisma.campaign.create({
          data: {
            name: campaignName,
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
        console.log(`[Seed] Created campaign: "${meta.name}" with ${items.length} steps.`);
      }
    }
  } catch (e) {
    console.error('[Seed] Seeding failed:', e);
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
