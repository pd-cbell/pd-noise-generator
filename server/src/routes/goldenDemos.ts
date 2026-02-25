import { Router } from 'express';
import { GoldenDemoService } from '../services/GoldenDemoService';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac'; // Import checkRole middleware
import { Role, SessionSource } from '@prisma/client'; // Import Role enum
import { z } from 'zod'; // For validation
import { simulationManager } from '../index';
import { serverConfig } from '../config';
import prisma from '../prisma';
import { decrypt } from '../utils/crypto';

const router = Router();
const goldenDemoService = new GoldenDemoService();

// Zod schema for GoldenDemo creation validation
const createGoldenDemoSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(255),
  vertical: z.string().min(1, 'Vertical cannot be empty').max(255),
  maturityLevel: z.string().min(1, 'Maturity Level cannot be empty').max(255),
  narrative: z.string().min(1, 'Narrative cannot be empty'),
  configJson: z.any(), // Loosely typed for now, can be more specific later
  personaNotes: z.string().max(1000).optional(),
  isShared: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

// Zod schema for GoldenDemo update validation
const updateGoldenDemoSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  vertical: z.string().min(1).max(255).optional(),
  maturityLevel: z.string().min(1).max(255).optional(),
  narrative: z.string().min(1).optional(),
  configJson: z.any().optional(),
  personaNotes: z.string().max(1000).optional(),
  isShared: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

const triggerGoldenDemo = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const mappingProfileId =
      (req.headers['x-mapping-profile-id'] as string) ||
      (req.query && req.query.mappingProfileId) ||
      (req.body && req.body.mappingProfileId) ||
      null;

    // Webhook does not require authentication, so userId might be undefined
    // For now, we allow trigger for anyone. If GoldenDemo is user-specific,
    // this will trigger with the ID of the user who created the Golden Demo.
    // If anonymous, pass undefined
    const userId = (req as any).user?.userId; 

    const demo = await goldenDemoService.getGoldenDemo(id, undefined as any); // Don't filter by userId for public trigger
    if (!demo) {
      return res.status(404).json({ message: 'Golden Demo not found' });
    }

    const owner = await prisma.user.findUnique({
      where: { id: demo.createdByUserId },
      select: {
        encryptedPagerDutyApiToken: true,
        encryptedGlobalRoutingKey: true,
        encryptedFromEmail: true,
        pdRegion: true,
      }
    });

    // Build credentials from headers/body/query/owner/env (best-effort)
    const globalRoutingKey =
      (req.headers['x-pd-routing-key'] as string) ||
      (req.query && req.query.globalRoutingKey) ||
      (req.body && req.body.globalRoutingKey) ||
      (owner?.encryptedGlobalRoutingKey ? decrypt(owner.encryptedGlobalRoutingKey) : '') ||
      serverConfig.pdEventsRoutingKey;
    const changeRoutingKey =
      (req.headers['x-pd-change-routing-key'] as string) ||
      (req.query && req.query.changeRoutingKey) ||
      (req.body && req.body.changeRoutingKey) ||
      serverConfig.pdChangeEventsRoutingKey;

    const credentials = {
      apiToken:
        (req.body && req.body.apiToken) ||
        (req.query && req.query.apiToken) ||
        (owner?.encryptedPagerDutyApiToken ? decrypt(owner.encryptedPagerDutyApiToken) : '') ||
        '',
      fromEmail:
        (req.body && req.body.fromEmail) ||
        (req.query && req.query.fromEmail) ||
        (owner?.encryptedFromEmail ? decrypt(owner.encryptedFromEmail) : '') ||
        '',
      globalRoutingKey: globalRoutingKey || '',
      pdRegion: req.body?.pdRegion || req.query?.pdRegion || owner?.pdRegion || 'US',
    };

    if (!credentials.globalRoutingKey) {
      return res.status(400).json({ message: 'Missing global routing key (header/body/env)' });
    }

    const simConfig = {
      ...(demo.configJson as any),
      mappingProfileId,
      changeRoutingKey: changeRoutingKey || (demo.configJson as any)?.changeRoutingKey,
      goldenDemoId: demo.id,
    };

    const items = Array.isArray((demo.configJson as any)?.items) ? (demo.configJson as any).items : [];
    if (items.length === 0) {
      return res.status(400).json({ message: 'Golden Demo has no scenario items to launch.' });
    }

    // Use the userId from the Golden Demo creator for the simulation session
    const instance = await simulationManager.createOrUpdate(demo.createdByUserId, simConfig, credentials);
    if (!instance.state.isRunning) {
      instance.start();
    }
    await instance.startTrack('scenario', items, undefined, mappingProfileId, {
      requesterId: userId,
      source: SessionSource.WEBHOOK,
    });

    res.status(202).json({
      message: 'Golden Demo scenario track started',
      goldenDemo: demo.name,
      mappingProfileId: mappingProfileId || null,
    });
  } catch (error) {
    console.error('Golden Demo webhook trigger failed:', error);
    res.status(500).json({
      message: 'Failed to trigger Golden Demo',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// --- Webhook trigger (public, no role check) ---
router.get('/:id/trigger', triggerGoldenDemo);
router.post('/:id/trigger', triggerGoldenDemo);

// All Golden Demo routes require authentication, then role-based checks
router.use(authenticateUser); 

// GET /api/golden-demos - List all golden demos for the authenticated user
router.get('/', checkRole([Role.VIEWER, Role.EDITOR, Role.ADMIN]), async (req, res) => {
  try {
    const { userId, role } = (req as any).user!;
    const { vertical } = req.query;
    const goldenDemos = await goldenDemoService.listGoldenDemos(
      userId,
      role,
      vertical ? String(vertical) : undefined
    );
    res.json(goldenDemos);
  } catch (error) {
    console.error('Error listing golden demos:', error);
    res.status(500).json({ message: 'Failed to list golden demos', error: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/golden-demos/:id - Get a specific golden demo
router.get('/:id', checkRole([Role.VIEWER, Role.EDITOR, Role.ADMIN]), async (req, res) => {
  try {
    const { userId, role } = (req as any).user!;
    const { id } = req.params;
    const goldenDemo = await goldenDemoService.getGoldenDemo(id, userId, role);
    if (!goldenDemo) {
      return res.status(404).json({ message: 'Golden Demo not found' });
    }
    res.json(goldenDemo);
  } catch (error) {
    console.error('Error getting golden demo:', error);
    res.status(500).json({ message: 'Failed to get golden demo', error: error instanceof Error ? error.message : String(error) });
  }
});

// POST /api/golden-demos - Create a new golden demo
router.post('/', checkRole([Role.VIEWER, Role.EDITOR, Role.ADMIN]), async (req, res) => {
  try {
    const { userId, role } = (req as any).user!;
    const validation = createGoldenDemoSchema.safeParse(req.body);

    if (validation.success && 'isStarred' in validation.data && role !== Role.ADMIN) {
      validation.data.isStarred = false;
    }

    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
    }

    const newGoldenDemo = await goldenDemoService.createGoldenDemo({
      ...validation.data,
      createdByUserId: userId,
    }, role);
    res.status(201).json(newGoldenDemo);
  } catch (error) {
    console.error('Error creating golden demo:', error);
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof Error && error.message.startsWith('Conflict')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to create golden demo', error: error instanceof Error ? error.message : String(error) });
  }
});

// PUT /api/golden-demos/:id - Update an existing golden demo
router.put('/:id', checkRole([Role.VIEWER, Role.EDITOR, Role.ADMIN]), async (req, res) => {
  try {
    const { userId, role } = (req as any).user!;
    const { id } = req.params;
    const validation = updateGoldenDemoSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
    }
    if ('isStarred' in validation.data && role !== Role.ADMIN) {
      delete (validation.data as any).isStarred;
    }

    const updatedGoldenDemo = await goldenDemoService.updateGoldenDemo(
      id,
      userId,
      role,
      validation.data
    );
    res.json(updatedGoldenDemo);
  } catch (error) {
    console.error('Error updating golden demo:', error);
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof Error && error.message.startsWith('Conflict')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update golden demo', error: error instanceof Error ? error.message : String(error) });
  }
});

// DELETE /api/golden-demos/:id - Delete a golden demo
router.delete('/:id', checkRole([Role.VIEWER, Role.EDITOR, Role.ADMIN]), async (req, res) => {
  try {
    const { userId, role } = (req as any).user!;
    const { id } = req.params;
    await goldenDemoService.deleteGoldenDemo(id, userId, role);
    res.status(204).send(); // No content
  } catch (error) {
    console.error('Error deleting golden demo:', error);
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return res.status(403).json({ message: error.message });
    }
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({ message: 'Golden Demo not found' });
    }
    res.status(500).json({ message: 'Failed to delete golden demo', error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
