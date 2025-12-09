import { Router } from 'express';
import { agentService } from '../services/AgentService';

const router = Router();

router.post('/proposal', async (req, res) => {
  const { prompt, provider } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const summary = await agentService.generateProposal(prompt, provider);
    res.json({ summary });
  } catch (error: any) {
    console.error("Proposal Error:", error);
    res.status(500).json({ error: error.message || 'Failed to generate proposal' });
  }
});

router.post('/build', async (req, res) => {
  const { prompt, approvedPlan, provider, services, eventCount, changeCount } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const campaign = await agentService.buildCampaign({
        prompt, 
        approvedPlan, 
        provider,
        services,
        eventCount,
        changeCount
    });
    res.json(campaign);
  } catch (error: any) {
    console.error("Build Error:", error);
    res.status(500).json({ error: error.message || 'Failed to build campaign' });
  }
});

export default router;
