import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { serverConfig } from './config';
import proxyRouter from './routes/proxy';
import profilesRouter from './routes/profiles';
import campaignsRouter from './routes/campaigns';
import taxonomyRouter from './routes/taxonomy';
import createAgentRouter from './routes/agent'; // Renamed import
import simulationRouter from './routes/simulation';
import authRouter from './routes/auth';
import goldenDemosRouter from './routes/goldenDemos';
import { SimulationManager } from './services/ServerSimulationEngine';
import { GoldenDemoService } from './services/GoldenDemoService'; // New import
import { AgentService } from './services/AgentService'; // New import
import prisma from './prisma'; // New import for prisma client

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

const goldenDemoService = new GoldenDemoService(prisma); // Instantiate GoldenDemoService
const agentService = new AgentService(goldenDemoService); // Instantiate AgentService with GoldenDemoService

io.on('connection', (socket) => {
  const userId = socket.data.user.userId;
  socket.join(userId);
  console.log(`User ${userId} connected via Socket.io`);
  
  // Check for existing simulation
  const existingSim = simulationManager.get(userId);
  if (existingSim && existingSim.state.isRunning) {
      socket.emit('sim_state', existingSim.state);
  }

  socket.on('start_simulation', (data) => {
      const sim = simulationManager.createOrUpdate(userId, data.config, data.credentials);
      sim.start();
      socket.emit('sim_started');
  });

  socket.on('stop_simulation', () => {
      const sim = simulationManager.get(userId);
      if (sim) sim.stop();
      socket.emit('sim_stopped');
  });

  // --- Interaction Events ---
  socket.on('ack_incident', (dedupKey) => {
      const sim = simulationManager.get(userId);
      if (sim) sim.ackIncident(dedupKey);
  });

  socket.on('resolve_incident', (dedupKey) => {
      const sim = simulationManager.get(userId);
      if (sim) sim.resolveIncident(dedupKey);
  });

  socket.on('clear_incidents', () => {
      const sim = simulationManager.get(userId);
      if (sim) sim.clearActiveIncidents();
  });

  socket.on('resolve_all', () => {
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
app.use('/api/campaigns', campaignsRouter);
app.use('/api/taxonomy', taxonomyRouter);
app.use('/api/agent', createAgentRouter(agentService));
app.use('/api/simulation', simulationRouter);
app.use('/auth', authRouter);
app.use('/api/golden-demos', goldenDemosRouter); // New route

app.get('/', (req, res) => {
  res.send('PD Noise Simulator API is running!');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
