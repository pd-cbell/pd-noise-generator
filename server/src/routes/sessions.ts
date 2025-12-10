import { Router } from 'express';
import { SessionService } from '../services/SessionService';
import { SimulationManager } from '../services/ServerSimulationEngine';
import { authenticateUser } from '../middleware/auth';

const sessionService = new SessionService();

export default (simulationManager: SimulationManager) => {
  const router = Router();
  router.use(authenticateUser);

  // POST /api/sessions/start
  router.post('/start', async (req, res) => {
    try {
      const { goldenDemoId, name, notes } = req.body;
      const userId = req.user!.id;

      if (!goldenDemoId) {
        return res.status(400).json({ message: 'goldenDemoId is required' });
      }

      const session = await sessionService.startSession({
        goldenDemoId,
        name,
        notes,
        createdByUserId: userId,
      });

      // We DON'T start the simulation here explicitly; the frontend does that via socket.
      // But we could? Ideally, "Start Session" -> Create Record AND Start Sim.
      // For now, let's keep them loosely coupled or assume the frontend calls this 
      // immediately after/before socket.emit('start_simulation').
      // Better yet: Frontend calls this, gets session ID, then emits start_simulation with session ID?
      // Let's stick to the roadmap: This just creates the record.

      res.status(201).json(session);
    } catch (error) {
      console.error('Error starting session:', error);
      res.status(500).json({ message: 'Failed to start session', error: String(error) });
    }
  });

  // POST /api/sessions/:id/end
  router.post('/:id/end', async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const userId = req.user!.id;

      // Capture Metrics from active simulation
      const simInstance = simulationManager.get(userId);
      let metricsSnapshot = {};
      
      if (simInstance) {
          // Extract lightweight snapshot
          metricsSnapshot = {
              totalEvents: simInstance.state.totalEvents,
              activeIncidents: simInstance.state.activeIncidents.length,
              avgMtta: simInstance.state.metrics.avgMtta,
              avgMttr: simInstance.state.metrics.avgMttr,
              apiRpm: simInstance.state.metrics.apiRpm,
              droppedEvents: simInstance.state.metrics.droppedEvents
          };
      }

      const session = await sessionService.endSession(id, metricsSnapshot, notes);
      
      // Optionally stop simulation?
      // simInstance?.stop(); 

      res.json(session);
    } catch (error) {
      console.error('Error ending session:', error);
      res.status(500).json({ message: 'Failed to end session', error: String(error) });
    }
  });

  // GET /api/sessions
  router.get('/', async (req, res) => {
    try {
      const userId = req.user!.id;
      const { goldenDemoId } = req.query;
      const sessions = await sessionService.listSessions(userId, goldenDemoId ? String(goldenDemoId) : undefined);
      res.json(sessions);
    } catch (error) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ message: 'Failed to list sessions', error: String(error) });
    }
  });

  // GET /api/sessions/:id
  router.get('/:id', async (req, res) => {
      try {
          const session = await sessionService.getSession(req.params.id);
          if (!session) return res.status(404).json({ message: 'Session not found' });
          res.json(session);
      } catch (error) {
          res.status(500).json({ message: 'Failed to get session' });
      }
  });

  return router;
};
