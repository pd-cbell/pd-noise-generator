import { Router } from 'express';
import prisma from '../prisma';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { simulationManager } from '../index';

const router = Router();
router.use(authenticateUser);

router.post('/trigger', async (req: any, res: any) => {
    const { userId } = (req as AuthRequest).user!;
    const { templateId } = req.body;

    if (!templateId) return res.status(400).json({ error: "templateId is required" });

    try {
        const template = await prisma.incidentTemplate.findUnique({ where: { id: templateId } });
        if (!template) return res.status(404).json({ error: "Template not found" });

        const sim = simulationManager.get(userId);
        if (!sim) return res.status(400).json({ error: "Simulation not active. Please start the simulation first." });

        await sim.triggerTemplate(template);

        res.json({ message: "Triggered", summary: (template.payload as any).summary });
    } catch (error: any) {
        console.error("Trigger failed:", error);
        res.status(500).json({ error: "Failed to trigger template", details: error.message });
    }
});

router.post('/scenario', async (req: any, res: any) => {
    const { userId } = (req as AuthRequest).user!;
    const { scenario } = req.body;

    if (!scenario) return res.status(400).json({ error: "scenario is required" });

    const sim = simulationManager.get(userId);
    if (!sim) return res.status(400).json({ error: "Simulation not active." });

    sim.setScenario(scenario);
    res.json({ message: `Active scenario set to '${scenario}'` });
});

export default router;
