import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/campaigns - List all campaigns with items
router.get('/', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`[API] Fetched ${campaigns.length} campaigns from DB.`);
    res.json({ campaigns });
  } catch (error: any) {
    console.error('[API] Failed to fetch campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
  }
});

// POST /api/campaigns - Create a new campaign
router.post('/', async (req, res) => {
  try {
    const { name, description, source, items } = req.body;
    
    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        source,
        items: {
          create: (items || []).map((item: any, idx: number) => ({
            order: idx,
            payload: item.payload || {},
            eventAction: item.eventAction || 'trigger',
            eventType: item.eventType || 'alert',
            dedupKey: item.dedupKey,
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

// GET /api/campaigns/:id - Get a single campaign
router.get('/:id', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch campaign', details: error.message });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete campaign', details: error.message });
  }
});

export default router;
