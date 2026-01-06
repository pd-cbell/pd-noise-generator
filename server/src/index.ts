import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { serverConfig } from './config';
import proxyRouter from './routes/proxy';
import profilesRouter from './routes/profiles';
import taxonomyRouter from './routes/taxonomy';
import createAgentRouter from './routes/agent'; // Renamed import
import createSessionsRouter from './routes/sessions'; // New import
import simulationRouter from './routes/simulation';
import authRouter from './routes/auth';
import goldenDemosRouter from './routes/goldenDemos';
import mappingProfilesRouter from './routes/mappingProfiles';
import usersRouter from './routes/users'; // New import
import { SimulationManager } from './services/ServerSimulationEngine';
import { GoldenDemoService } from './services/GoldenDemoService'; // New import
import { AgentService } from './services/AgentService'; // New import
import prisma from './prisma'; // New import for prisma client
import { Role } from '@prisma/client';
import {
  DEFAULT_AUTO_HEAL_CONFIG,
  DEFAULT_SEVERITY_CONFIGS,
  DEFAULT_SOURCE_MIX,
  SimulationConfig,
} from './types';
import { decrypt } from './utils/crypto';

console.log("Environment Loaded. GEMINI_API_KEY present:", serverConfig.geminiApiKeyPresent);

const app = express();
const server = http.createServer(app);
const CLIENT_URL = serverConfig.clientUrl;

app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
});

// Socket Auth Middleware
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return next(new Error('Authentication error'));
  
  const cookies = cookieHeader.split(';').reduce<Record<string, string>>((res, item) => {
      const data = item.trim().split('=');
      return { ...res, [data[0]]: data[1] };
  }, {});

  const token = cookies['token'];
  if (!token) return next(new Error('Authentication error'));

  try {
    const decoded = jwt.verify(token, serverConfig.jwtSecret);
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Create the singleton instance
const simulationManager = new SimulationManager(io);
export { simulationManager };

const goldenDemoService = new GoldenDemoService(); // Instantiate GoldenDemoService
const agentService = new AgentService(goldenDemoService); // Instantiate AgentService with GoldenDemoService

io.on('connection', async (socket) => {
  const userId = socket.data.user.userId;
  socket.join(userId);
  console.log(`User ${userId} connected via Socket.io`);
  let user: { role: Role; agentEnabled: boolean } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, agentEnabled: true },
    });
  } catch (err) {
    socket.disconnect();
    return;
  }
  if (!user) {
    socket.disconnect();
    return;
  }
  socket.data.user.role = user.role;
  socket.data.user.agentEnabled = user.agentEnabled;
  const canLaunchScenario = (role?: Role) =>
    role === Role.VIEWER || role === Role.EDITOR || role === Role.ADMIN;
  const canControlBackground = (role?: Role) =>
    role === Role.EDITOR || role === Role.ADMIN;
  
  // Check for existing simulation
  const existingSim = simulationManager.get(userId);
  if (existingSim && existingSim.state.isRunning) {
      socket.emit('sim_state', existingSim.state);
  }

  socket.on('request_sim_state', (callback?: (payload: any) => void) => {
    try {
      const sim = simulationManager.get(userId);
      if (sim) {
        socket.emit('sim_state', sim.state);
        if (callback) callback({ ok: true });
      } else {
        if (callback) callback({ ok: false, message: 'No active simulation' });
      }
    } catch (err: any) {
      if (callback) callback({ ok: false, message: err?.message || 'Failed to fetch sim state' });
    }
  });

  socket.on('stop_track', ({ trackId }: { trackId: string }, callback?: (err?: any) => void) => {
    try {
      if (!canLaunchScenario(socket.data.user.role)) {
        if (callback) callback({ message: 'Forbidden' });
        return;
      }
      const session = simulationManager.get(userId);
      if (!session) {
        if (callback) callback({ message: 'Session not found' });
        return;
      }
      session.stopTrack(trackId);
      if (callback) callback(null);
    } catch (err: any) {
      console.error('stop_track error:', err);
      if (callback) callback({ message: err?.message || 'Failed to stop track' });
    }
  });

  socket.on('inject_golden_demo_items', async ({ items, mappingProfileId }: { items: any[], mappingProfileId?: string }, callback?: (err?: any) => void) => {
    try {
      if (!canLaunchScenario(socket.data.user.role)) {
        if (callback) callback({ message: 'Forbidden' });
        return;
      }
      let session = simulationManager.get(userId);
      if (!session) {
        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            encryptedPagerDutyApiToken: true,
            encryptedGlobalRoutingKey: true,
            encryptedFromEmail: true,
            pdRegion: true,
          },
        });
        if (!userRecord) {
          if (callback) callback({ message: 'User not found' });
          return;
        }
        const credentials = {
          apiToken: userRecord.encryptedPagerDutyApiToken
            ? decrypt(userRecord.encryptedPagerDutyApiToken)
            : '',
          globalRoutingKey: userRecord.encryptedGlobalRoutingKey
            ? decrypt(userRecord.encryptedGlobalRoutingKey)
            : '',
          fromEmail: userRecord.encryptedFromEmail ? decrypt(userRecord.encryptedFromEmail) : '',
          pdRegion: userRecord.pdRegion || 'US',
        };
        if (!credentials.globalRoutingKey) {
          if (callback) callback({ message: 'Missing global routing key' });
          return;
        }
        const baseConfig: SimulationConfig = {
          ratePerMinute: 0,
          severityWeights: { info: 0.2, warning: 0.4, error: 0.25, critical: 0.15 },
          autoHealConfig: DEFAULT_AUTO_HEAL_CONFIG,
          resumeExistingEnabled: false,
          sourceMix: DEFAULT_SOURCE_MIX,
          burstProbability: 0,
          majorIncidentProbability: 0,
          responderAckRate: 0,
          teamFailureProbability: 0,
          severityConfigs: DEFAULT_SEVERITY_CONFIGS,
          selectedServices: [],
          selectedTeamIds: [],
          mappingProfileId: mappingProfileId || null,
        };
        session = await simulationManager.createOrUpdate(userId, baseConfig, credentials);
      }
      const track = await session.startTrack('scenario', items);
      if (mappingProfileId) {
        await session.applyMappingToNewTrack(track, mappingProfileId);
      }
      if (callback) callback(null);
    } catch (err: any) {
      console.error('inject_golden_demo_items error:', err);
      if (callback) callback({ message: err?.message || 'Failed to inject demo items' });
    }
  });

  socket.on('start_simulation', async (data) => {
      try {
        if (!canControlBackground(socket.data.user.role)) {
          socket.emit('sim_error', { message: 'Forbidden' });
          return;
        }
        const sim = await simulationManager.createOrUpdate(userId, data.config, data.credentials);
        sim.start();
        socket.emit('sim_started');
      } catch (err: any) {
        console.error('start_simulation error:', err);
        socket.emit('sim_error', { message: err?.message || 'Failed to start simulation' });
      }
  });

  socket.on('stop_simulation', () => {
      if (!canControlBackground(socket.data.user.role)) {
        socket.emit('sim_error', { message: 'Forbidden' });
        return;
      }
      const sim = simulationManager.get(userId);
      if (sim) sim.stop();
      socket.emit('sim_stopped');
  });

  // --- Interaction Events ---
  socket.on('ack_incident', (dedupKey) => {
      if (!canLaunchScenario(socket.data.user.role)) return;
      const sim = simulationManager.get(userId);
      if (sim) sim.ackIncident(dedupKey);
  });

  socket.on('resolve_incident', (dedupKey) => {
      if (!canLaunchScenario(socket.data.user.role)) return;
      const sim = simulationManager.get(userId);
      if (sim) sim.resolveIncident(dedupKey);
  });

  socket.on('clear_incidents', () => {
      if (!canLaunchScenario(socket.data.user.role)) return;
      const sim = simulationManager.get(userId);
      if (sim) sim.clearActiveIncidents();
  });

  socket.on('resolve_all', () => {
      if (!canLaunchScenario(socket.data.user.role)) return;
      const sim = simulationManager.get(userId);
      if (sim) sim.resolveAllIncidents();
  });

  socket.on('disconnect', () => {
      // Clean up resources if necessary
  });
});

const PORT = serverConfig.port;

app.use('/proxy', proxyRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/taxonomy', taxonomyRouter);
app.use('/api/agent', createAgentRouter(agentService));
app.use('/api/sessions', createSessionsRouter(simulationManager)); // New Route
app.use('/api/simulation', simulationRouter);
app.use('/auth', authRouter);
app.use('/api/golden-demos', goldenDemosRouter); // New route
app.use('/api/mapping-profiles', mappingProfilesRouter);
app.use('/api/users', usersRouter); // New route

app.get('/', (req, res) => {
  res.send('PD Noise Simulator API is running!');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
