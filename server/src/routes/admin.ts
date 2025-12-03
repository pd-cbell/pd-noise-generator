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
    const { topic, count, scenario = "General" } = req.body;

    if (!topic || !count) {
        return res.status(400).json({ error: "topic and count are required" });
    }

    try {
        const templates = await aiService.generateTemplateBatch(topic, Number(count));
        
        // Save to DB
        const created = await prisma.incidentTemplate.createMany({
            data: templates.map((t: any) => ({
                topic,
                payload: t.payload,
                slackMessage: t.slack_message,
                scenario // Save category
            }))
        });

        res.json({ message: `Generated and saved ${created.count} templates for '${topic}' in scenario '${scenario}'` });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to generate templates", details: error.message });
    }
});

// GET /api/admin/scenarios
router.get('/scenarios', async (req, res) => {
    try {
        const scenarios = await prisma.incidentTemplate.findMany({
            select: { scenario: true },
            distinct: ['scenario']
        });
        res.json(scenarios.map(s => s.scenario));
    } catch (error: any) {
        res.status(500).json({ error: "Failed to fetch scenarios" });
    }
});

export default router;
