import { Router } from 'express';
import prisma from '../prisma';
import { aiService } from '../services/AiService';

const router = Router();

// GET /api/admin/templates
router.get('/templates', async (req, res) => {
    try {
        const templates = await prisma.incidentTemplate.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(templates);
    } catch (error: any) {
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// POST /api/admin/generate-templates
router.post('/generate-templates', async (req, res) => {
    const { topic, count } = req.body;

    if (!topic || !count) {
        return res.status(400).json({ error: "topic and count are required" });
    }

    try {
        const templates = await aiService.generateTemplateBatch(topic, Number(count));
        
        // Save to DB
        const created = await prisma.incidentTemplate.createMany({
            data: templates.map(t => ({
                topic,
                payload: t
            }))
        });

        res.json({ message: `Generated and saved ${created.count} templates for '${topic}'` });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to generate templates", details: error.message });
    }
});

export default router;
