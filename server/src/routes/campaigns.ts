import { Router, Response } from 'express';
import prisma from '../prisma';
import { CampaignExecutor } from '../services/CampaignExecutor';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { simulationManager } from '../index';
import { serverConfig } from '../config';

const router = Router();

// POST /api/campaigns/:id/trigger - Webhook trigger (Public/Unauthenticated)
router.post('/:id/trigger', async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    // Fetch campaign (No user scoping here, allows CI/CD triggering)
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const globalRoutingKey =
      (req.headers['x-pd-routing-key'] as string) ||
      req.body.globalRoutingKey ||
      campaign.integrationKey ||
      serverConfig.pdEventsRoutingKey;
    const changeRoutingKey =
      (req.headers['x-pd-change-routing-key'] as string) ||
      req.body.changeRoutingKey ||
      campaign.integrationKey ||
      serverConfig.pdChangeEventsRoutingKey;

    const hasIncidents = campaign.items.some((i) => i.eventType === 'incident');
    const hasChangeEvents = campaign.items.some((i) => i.eventType === 'change');

    if (hasIncidents && !globalRoutingKey) {
      return res.status(400).json({ error: "Missing incident routing key (header, body, campaign default, env)" });
    }
    if (hasChangeEvents && !changeRoutingKey) {
      return res.status(400).json({ error: "Missing change routing key (header, body, campaign default, env)" });
    }

    // Try to find active simulation for this user to log progress
    if (!campaign.userId) {
        // Should not happen with Prisma foreign keys but good for TS
        return res.status(500).json({ error: "Campaign has no associated user" });
    }
    const instance = simulationManager.get(campaign.userId);

    const executor = new CampaignExecutor({
      globalRoutingKey,
      changeRoutingKey
    }, instance);
    
    executor.run(campaign).catch(err => {
      console.error(`[Webhook] Execution failed for ${campaignId}:`, err);
      if (instance) {
        instance.addLog(`[Webhook] Execution failed for ${campaignId}: ${err.message}`, 'error');
      }
    });

    res.status(202).json({ 
      message: "Campaign execution started", 
      campaign: campaign.name,
      steps: campaign.items.length 
    });

  } catch (error: any) {
    res.status(500).json({ error: "Failed to trigger campaign", details: error.message });
  }
});

// Apply auth middleware to all subsequent routes (CRUD)
router.use(authenticateUser);

// POST /api/campaigns/import - Import Crux campaigns
router.post('/import', async (req: any, res: Response) => {
  const { userId } = (req as AuthRequest).user!;
  
  let groups = [];
  if (Array.isArray(req.body)) {
      groups = req.body;
  } else if (req.body && typeof req.body === 'object') {
      // Handle single object (either wrapped in event_group or just the group itself)
      groups = [req.body];
  }
  
  if (groups.length === 0) {
      return res.status(400).json({ error: "No event groups found in payload" });
  }

  let importedCount = 0;
  const errors: string[] = [];

  for (const entry of groups) {
      const group = entry.event_group || entry;
      const items = Array.isArray(group?.event_group_items) ? group.event_group_items : [];
      
      if (!items.length) continue;

      const campaignData = {
          name: group.name || `Imported Campaign ${Date.now()}`,
          description: group.description || "Imported from Crux",
          source: "Crux Import",
          userId,
          items: {
              create: items.map((item: any, idx: number) => ({
                  order: idx,
                  stepName: `Step ${idx + 1}`,
                  payload: JSON.parse(item.payload || '{}'), // Ensure it's stored as JSON object
                  eventAction: item.event_action || 'trigger',
                  eventType: item.event_type === 'change' ? 'change' : 'alert',
                  dedupKey: item.dedup_key || null,
                  delaySeconds: Number(item.delay_seconds) || 0,
                  repeatCount: Number(item.times) || 1,
                  intervalSeconds: Number(item.interval_seconds) || 0,
              }))
          }
      };

      try {
          await prisma.campaign.create({ data: campaignData });
          importedCount++;
      } catch (e: any) {
          errors.push(`Failed to import "${campaignData.name}": ${e.message}`);
      }
  }

  res.json({ 
      message: `Successfully imported ${importedCount} campaigns.`, 
      errors: errors.length > 0 ? errors : undefined 
  });
});

// GET /api/campaigns - List all campaigns for the logged-in user
router.get('/', async (req: any, res: Response) => {
  const { userId } = (req as AuthRequest).user!;
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ campaigns });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
  }
});

// POST /api/campaigns - Create a new campaign
router.post('/', async (req: any, res: Response) => {
  const { userId } = (req as AuthRequest).user!;
  try {
    const { name, description, source, integrationKey, items } = req.body;
    
    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        source,
        integrationKey,
        userId, // Assign owner
        items: {
          create: (items || []).map((item: any, idx: number) => ({
            order: idx,
            stepName: item.stepName,
            payload: item.payload || {},
            eventAction: item.eventAction || 'trigger',
            eventType: item.eventType || 'alert',
            dedupKey: item.dedupKey,
            integrationKey: item.integrationKey,
            delaySeconds: Number(item.delaySeconds) || 0,
            repeatCount: Number(item.repeatCount) || 1,
            intervalSeconds: Number(item.intervalSeconds) || 0,
          }))
        }
      },
      include: { items: true }
    });
    res.status(201).json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create campaign', details: error.message });
  }
});

// GET /api/campaigns/:id - Get a single campaign (Scoped)
router.get('/:id', async (req: any, res: Response) => {
  const { userId } = (req as AuthRequest).user!;
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch campaign', details: error.message });
  }
});

// PUT /api/campaigns/:id - Update a campaign (Scoped)
router.put('/:id', async (req: any, res: Response) => {
  const { userId } = (req as AuthRequest).user!;
  try {
    // Ensure ownership
    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    const { name, description, source, integrationKey, items } = req.body;
    const campaignId = req.params.id;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Campaign details
      const campaign = await tx.campaign.update({
        where: { id: campaignId },
        data: { name, description, source, integrationKey },
      });

      // 2. Delete existing items
      await tx.campaignItem.deleteMany({
        where: { campaignId },
      });

      // 3. Create new items
      if (items && items.length > 0) {
        await tx.campaignItem.createMany({
          data: items.map((item: any, idx: number) => ({
            campaignId,
            order: idx,
            stepName: item.stepName,
            payload: item.payload || {}, 
            eventAction: item.eventAction || 'trigger',
            eventType: item.eventType || 'alert', 
            dedupKey: item.dedupKey,
            integrationKey: item.integrationKey,
            delaySeconds: Number(item.delaySeconds) || 0,
            repeatCount: Number(item.repeatCount) || 1,
            intervalSeconds: Number(item.intervalSeconds) || 0,
          })),
        });
      }

      return campaign;
    });

    // Fetch final result with items to return
    const finalCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    res.json(finalCampaign);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update campaign', details: error.message });
  }
});

// DELETE /api/campaigns/:id - Delete a campaign (Scoped)
router.delete('/:id', async (req: any, res: Response) => {
  const { userId } = (req as AuthRequest).user!;
  try {
    // Ensure ownership
    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete campaign', details: error.message });
  }
});

export default router;
