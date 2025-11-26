import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import proxyRouter from './routes/proxy';
import profilesRouter from './routes/profiles';
import campaignsRouter from './routes/campaigns';
import authRouter from './routes/auth';
import { simulationManager } from './services/ServerSimulationEngine';

dotenv.config();

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

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
  
  const cookies = cookieHeader.split(';').reduce((res, item) => {
      const data = item.trim().split('=');
      return { ...res, [data[0]]: data[1] };
  }, {} as any);

  const token = cookies['token'];
  if (!token) return next(new Error('Authentication error'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key-change-me');
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.user.userId;
  socket.join(userId);
  console.log(`User ${userId} connected via Socket.io`);
  
  // Check for existing simulation
  const existingSim = simulationManager.get(userId);
  if (existingSim && existingSim.state.isRunning) {
      socket.emit('sim_state', existingSim.state);
  }

  // Polling interval to push state to this specific socket
  // In a real app, we'd emit to the 'room' (userId) from the engine itself
  // to support multiple tabs.
  const pushInterval = setInterval(() => {
      const sim = simulationManager.get(userId);
      if (sim && sim.state.isRunning) {
          socket.emit('sim_tick', sim.state);
      }
  }, 1000);

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

  socket.on('disconnect', () => {
      clearInterval(pushInterval);
  });
});

const PORT = process.env.PORT || 3001;

app.use('/proxy', proxyRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/auth', authRouter);

app.get('/', (req, res) => {
  res.send('PD Noise Simulator API is running!');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});