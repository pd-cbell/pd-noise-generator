import { Router } from 'express';
import prisma from '../prisma';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateUser);
router.use(checkRole([Role.ADMIN]));

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list users', details: error.message });
  }
});

// PUT /api/users/:id/role - Update user role
router.put('/:id/role', async (req, res) => {
  const { role } = req.body;
  
  if (!Object.values(Role).includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, role: true }
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update user role', details: error.message });
  }
});

export default router;
