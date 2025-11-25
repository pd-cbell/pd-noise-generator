import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/profiles - List all profiles
router.get('/', async (req, res) => {
  try {
    const profiles = await prisma.profile.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ profiles });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch profiles', details: error.message });
  }
});

// GET /api/profiles/:id - Get a single profile
router.get('/:id', async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.params.id },
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
router.post('/', async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    const profile = await prisma.profile.create({
      data: {
        name,
        description,
        settings: settings || {},
      },
    });
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create profile', details: error.message });
  }
});

// PUT /api/profiles/:id - Update a profile
router.put('/:id', async (req, res) => {
  try {
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
router.delete('/:id', async (req, res) => {
  try {
    await prisma.profile.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete profile', details: error.message });
  }
});

export default router;
