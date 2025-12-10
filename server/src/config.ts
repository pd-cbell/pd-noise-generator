import dotenv from 'dotenv';

// Load environment once at process start
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const resolvedJwtSecret =
  process.env.JWT_SECRET || (!isProduction ? 'dev-secret-key-change-me' : undefined);

if (!resolvedJwtSecret) {
  throw new Error('JWT_SECRET is required in production');
}

const port = Number(process.env.PORT) || 3001;

export const serverConfig = {
  nodeEnv,
  isProduction,
  jwtSecret: resolvedJwtSecret,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  pdApiBase: process.env.PD_API_BASE || 'https://api.pagerduty.com',
  pdEventsRoutingKey: process.env.PD_EVENTS_ROUTING_KEY,
  pdChangeEventsRoutingKey: process.env.PD_CHANGE_EVENTS_ROUTING_KEY,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  geminiApiKeyPresent: Boolean(process.env.GEMINI_API_KEY),
  openAiApiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
  port,
};
