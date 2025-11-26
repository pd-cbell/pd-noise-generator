import { SimulationManager } from './services/ServerSimulationEngine'; // Import the class

// ... (other code)

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

const simulationManager = new SimulationManager(io); // Create the singleton instance

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

  socket.on('disconnect', () => {
      // Clean up resources if necessary
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