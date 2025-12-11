import { Router } from 'express';
import { GoldenDemoService } from '../services/GoldenDemoService';
import { authenticateUser } from '../middleware/auth';
import { z } from 'zod'; // For validation

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

router.use(authenticateUser); // All Golden Demo routes require authentication

// GET /api/golden-demos - List all golden demos for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
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
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
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
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const validation = createGoldenDemoSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.errors });
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
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validation = updateGoldenDemoSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.errors });
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
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
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
