import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac';
import { Role } from '@prisma/client';
import { serverConfig } from '../config';

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
        agentEnabled: true,
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

// PUT /api/users/:id/agent-enabled - Update agent access
router.put('/:id/agent-enabled', async (req, res) => {
  const { agentEnabled } = req.body;

  if (typeof agentEnabled !== 'boolean') {
    return res.status(400).json({ error: 'agentEnabled must be a boolean' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { agentEnabled },
      select: { id: true, email: true, agentEnabled: true },
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update agent access', details: error.message });
  }
});

// POST /api/users/:id/impersonate - Impersonate user (Admin only)
router.post('/:id/impersonate', async (req, res) => {
  try {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const adminUserId = req.user?.userId;
    const adminEmail = req.user?.email;
    if (!adminUserId || !adminEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionToken = jwt.sign(
      { userId: targetUser.id, email: targetUser.email, impersonatorId: adminUserId },
      serverConfig.jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie('token', sessionToken, {
      httpOnly: true,
      secure: serverConfig.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: 'Impersonation started', userId: targetUser.id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to impersonate user', details: error.message });
  }
});

export default router;
