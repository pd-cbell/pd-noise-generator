import { Router } from 'express';
import { GoldenDemoService } from '../services/GoldenDemoService';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac'; // Import checkRole middleware
import { UserRole } from '@prisma/client'; // Import UserRole enum
import { z } from 'zod'; // For validation
import { simulationManager } from '../index';
import { serverConfig } from '../config';

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
});

// Zod schema for GoldenDemo update validation
const updateGoldenDemoSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  vertical: z.string().min(1).max(255).optional(),
  maturityLevel: z.string().min(1).max(255).optional(),
  narrative: z.string().min(1).optional(),
  configJson: z.any().optional(),
  personaNotes: z.string().max(1000).optional(),
});

// All Golden Demo routes require authentication, then role-based checks
router.use(authenticateUser); 

// --- Webhook trigger (public, no role check) ---
router.post('/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;
    const mappingProfileId =
      (req.headers['x-mapping-profile-id'] as string) ||
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

    // Build credentials from headers/body/env (best-effort)
    const globalRoutingKey =
      (req.headers['x-pd-routing-key'] as string) ||
      (req.body && req.body.globalRoutingKey) ||
      serverConfig.pdEventsRoutingKey;
    const changeRoutingKey =
      (req.headers['x-pd-change-routing-key'] as string) ||
      (req.body && req.body.changeRoutingKey) ||
      serverConfig.pdChangeEventsRoutingKey;

    const credentials = {
      apiToken: (req.body && req.body.apiToken) || '',
      fromEmail: (req.body && req.body.fromEmail) || '',
      globalRoutingKey: globalRoutingKey || '',
      pdRegion: req.body?.pdRegion || 'US',
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

    // Use the userId from the Golden Demo creator for the simulation session
    const instance = await simulationManager.createOrUpdate(demo.createdByUserId, simConfig, credentials);
    instance.start();

    res.status(202).json({
      message: 'Golden Demo simulation started',
      goldenDemo: demo.name,
    });
  } catch (error) {
    console.error('Golden Demo webhook trigger failed:', error);
    res.status(500).json({
      message: 'Failed to trigger Golden Demo',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/golden-demos - List all golden demos for the authenticated user
router.get('/', checkRole([UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const userId = (req as any).user!.userId; // Access userId from req.user
    const { vertical } = req.query;
    const goldenDemos = await goldenDemoService.listGoldenDemos(
      userId,
      vertical ? String(vertical) : undefined
    );
    res.json(goldenDemos);
  } catch (error) {
    console.error('Error listing golden demos:', error);
    res.status(500).json({ message: 'Failed to list golden demos', error: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/golden-demos/:id - Get a specific golden demo
router.get('/:id', checkRole([UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const userId = (req as any).user!.userId; // Access userId from req.user
    const { id } = req.params;
    const goldenDemo = await goldenDemoService.getGoldenDemo(id, userId);
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
router.post('/', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const userId = (req as any).user!.userId; // Access userId from req.user
    const validation = createGoldenDemoSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
    }

    const newGoldenDemo = await goldenDemoService.createGoldenDemo({
      ...validation.data,
      createdByUserId: userId,
    });
    res.status(201).json(newGoldenDemo);
  } catch (error) {
    console.error('Error creating golden demo:', error);
    res.status(500).json({ message: 'Failed to create golden demo', error: error instanceof Error ? error.message : String(error) });
  }
});

// PUT /api/golden-demos/:id - Update an existing golden demo
router.put('/:id', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const userId = (req as any).user!.userId; // Access userId from req.user
    const { id } = req.params;
    const validation = updateGoldenDemoSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.issues });
    }

    const updatedGoldenDemo = await goldenDemoService.updateGoldenDemo(
      id,
      userId,
      validation.data
    );
    res.json(updatedGoldenDemo);
  } catch (error) {
    console.error('Error updating golden demo:', error);
    res.status(500).json({ message: 'Failed to update golden demo', error: error instanceof Error ? error.message : String(error) });
  }
});

// DELETE /api/golden-demos/:id - Delete a golden demo
router.delete('/:id', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res) => {
  try {
    const userId = (req as any).user!.userId; // Access userId from req.user
    const { id } = req.params;
    await goldenDemoService.deleteGoldenDemo(id, userId);
    res.status(204).send(); // No content
  } catch (error) {
    console.error('Error deleting golden demo:', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return res.status(404).json({ message: 'Golden Demo not found' });
    }
    res.status(500).json({ message: 'Failed to delete golden demo', error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
