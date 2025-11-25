import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import proxyRouter from './routes/proxy';
import profilesRouter from './routes/profiles';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.use('/proxy', proxyRouter);
app.use('/api/profiles', profilesRouter);

app.get('/', (req, res) => {
  res.send('PD Noise Simulator API is running!');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
