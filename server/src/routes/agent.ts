import { Router } from 'express';
import { AgentService } from '../services/AgentService';
import { authenticateUser } from '../middleware/auth'; // Import authenticateUser
import { checkRole } from '../middleware/rbac'; // Import checkRole middleware
import { requireAgentEnabled } from '../middleware/agentAccess';
import { Role } from '@prisma/client'; // Import Role enum

export default (agentService: AgentService) => {
  const router = Router();

  router.use(authenticateUser); // All agent routes require authentication
  router.use(requireAgentEnabled);

  router.post('/proposal', checkRole([Role.EDITOR, Role.ADMIN]), async (req, res) => {
    const { prompt, provider, services, industry, useCase } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
      const summary = await agentService.generateProposal({
          prompt, 
          provider,
          services,
          industry,
          useCase
      });
      res.json({ summary });
    } catch (error: any) {
      console.error("Proposal Error:", error);
      res.status(500).json({ error: error.message || 'Failed to generate proposal' });
    }
  });

  router.post('/build', checkRole([Role.EDITOR, Role.ADMIN]), async (req, res) => {
    const { 
        prompt, 
        approvedPlan, 
        provider, 
        services, 
        eventCount, 
        changeCount,
        goldenDemoName,
        industry,
        useCase,
        narrative,
        personaNotes,
        // createdByUserId // This will come from req.user
    } = req.body;
    const { userId, role } = req.user!; // Get userId from authenticated user

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
      const campaign = await agentService.buildCampaign({
          prompt, 
          approvedPlan, 
          provider,
          services,
          eventCount,
          changeCount,
          goldenDemoName,
          industry,
          useCase,
          narrative,
          personaNotes,
          createdByUserId: userId, // Use userId from req.user
          role
      });
      res.json(campaign);
    } catch (error: any) {
      console.error("Build Error:", error);
      res.status(500).json({ error: error.message || 'Failed to build campaign' });
    }
  });

  return router;
};
