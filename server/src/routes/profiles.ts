import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac'; // Import checkRole middleware
import { UserRole } from '@prisma/client'; // Import UserRole enum

const router = Router();

// Apply auth middleware to all routes
router.use(authenticateUser);

// GET /api/profiles - List all profiles for the logged-in user
router.get('/', checkRole([UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN]), async (req, res: Response) => {
  const { userId } = req.user!;
  try {
    const profiles = await prisma.profile.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ profiles });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch profiles', details: error.message });
  }
});

// GET /api/profiles/:id - Get a single profile (scoped)
router.get('/:id', checkRole([UserRole.VIEWER, UserRole.EDITOR, UserRole.ADMIN]), async (req, res: Response) => {
  const { userId } = req.user!;
  try {
    const profile = await prisma.profile.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
  }
});

// POST /api/profiles - Create a new profile
router.post('/', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res: Response) => {
  const { userId } = req.user!;
  try {
    const { name, description, settings } = req.body;
    const profile = await prisma.profile.create({
      data: {
        name,
        description,
        settings: settings || {},
        userId,
      },
    });
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create profile', details: error.message });
  }
});

// PUT /api/profiles/:id - Update a profile
router.put('/:id', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res: Response) => {
  const { userId } = req.user!;
  try {
    // Ensure ownership
    const existing = await prisma.profile.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Profile not found' });

    const { name, description, settings } = req.body;
    const profile = await prisma.profile.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        settings,
      },
    });
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// DELETE /api/profiles/:id - Delete a profile
router.delete('/:id', checkRole([UserRole.EDITOR, UserRole.ADMIN]), async (req, res: Response) => {
  const { userId } = req.user!;
  try {
    // Ensure ownership
    const existing = await prisma.profile.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Profile not found' });

    await prisma.profile.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete profile', details: error.message });
  }
});

export default router;