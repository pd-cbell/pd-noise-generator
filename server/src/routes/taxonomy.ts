import { Router } from 'express';
import prisma from '../prisma';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac'; // Import checkRole middleware
import { Role } from '@prisma/client'; // Import Role enum

const router = Router();
router.use(authenticateUser);

// --- Domains ---
router.get('/domains', checkRole([Role.VIEWER, Role.EDITOR, Role.ADMIN]), async (req, res) => {
  try {
    const domains = await prisma.domain.findMany({
      include: {
        teams: {
          include: {
            services: {
              include: {
                templates: true
              }
            }
          }
        }
      }
    });
    res.json(domains);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/domains', checkRole([Role.ADMIN]), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  
  try {
    const domain = await prisma.domain.create({ data: { name } });
    res.json(domain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- Teams ---
router.post('/teams', checkRole([Role.ADMIN]), async (req, res) => {
  const { name, persona, domainId } = req.body;
  if (!name || !domainId) return res.status(400).json({ error: "Name and DomainId are required" });

  try {
    const team = await prisma.team.create({
      data: { name, persona, domainId }
    });
    res.json(team);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- Services ---
router.post('/services', checkRole([Role.ADMIN]), async (req, res) => {
  const { name, teamId, integrationKey } = req.body;
  if (!name || !teamId) return res.status(400).json({ error: "Name and TeamId are required" });

  try {
    const service = await prisma.service.create({
      data: { name, teamId, integrationKey }
    });
    res.json(service);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- Templates ---
router.post('/templates', checkRole([Role.ADMIN]), async (req, res) => {
  const { name, template, serviceId, description, isDraft } = req.body;
  if (!name || !template || !serviceId) return res.status(400).json({ error: "Name, Template, and ServiceId are required" });

  try {
    const newTemplate = await prisma.payloadTemplate.create({
      data: {
        name,
        template,
        serviceId,
        description,
        isDraft: isDraft ?? true
      }
    });
    res.json(newTemplate);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
