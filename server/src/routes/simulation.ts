import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateUser } from '../middleware/auth';
import { checkRole } from '../middleware/rbac'; // Import checkRole middleware
import { Role } from '@prisma/client'; // Import Role enum
import { simulationManager } from '../index';
import { fakerService } from '../services/FakerService';

const router = Router();
router.use(authenticateUser);

router.post('/trigger-template', checkRole([Role.EDITOR, Role.ADMIN]), async (req, res: Response) => {
    const { userId } = req.user!;
    const { templateId } = req.body;

    if (!templateId) return res.status(400).json({ error: "templateId is required" });

    try {
        // 1. Fetch Template
        const template = await prisma.payloadTemplate.findUnique({ 
            where: { id: templateId },
            include: { service: true } 
        });
        
        if (!template) return res.status(404).json({ error: "Template not found" });

        // 2. Get Simulation Instance
        const sim = simulationManager.get(userId);
        if (!sim) return res.status(400).json({ error: "Simulation not active. Please configure/start simulation first." });

        // 3. Trigger via Engine
        await sim.triggerTemplate(
            { 
                name: template.name, 
                template: template.template, 
                slackMessageTemplate: template.slackMessageTemplate 
            }, 
            template.serviceId, 
            template.service.integrationKey
        );

        res.json({ message: "Triggered", summary: template.name });
    } catch (error: any) {
        console.error("Trigger failed:", error);
        res.status(500).json({ error: "Failed to trigger template", details: error.message });
    }
});

router.post('/preview-template', checkRole([Role.EDITOR, Role.ADMIN]), async (req, res: Response) => {
    const { userId } = req.user!; // Ensure userId is available, though not used here
    const { templateId } = req.body;
    if (!templateId) return res.status(400).json({ error: "templateId is required" });

    try {
        const template = await prisma.payloadTemplate.findUnique({ where: { id: templateId } });
        if (!template) return res.status(404).json({ error: "Template not found" });

        const payload = fakerService.generatePayload(template.template);
        res.json(payload);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
