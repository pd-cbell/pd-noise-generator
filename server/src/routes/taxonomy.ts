import { Router } from 'express';
import prisma from '../prisma';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateUser);

// --- Domains ---
router.get('/domains', async (req, res) => {
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

router.post('/domains', async (req: any, res: any) => {
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
router.post('/teams', async (req: any, res: any) => {
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
router.post('/services', async (req: any, res: any) => {
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
router.post('/templates', async (req: any, res: any) => {
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
