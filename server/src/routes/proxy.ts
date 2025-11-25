import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

const {
  PD_API_BASE = 'https://api.pagerduty.com',
  PD_FROM_EMAIL,
} = process.env;

const PD_EVENTS_URL = 'https://events.pagerduty.com/v2/enqueue';
const PD_CHANGE_EVENTS_URL = 'https://events.pagerduty.com/v2/change/enqueue';
const pdRestBase = PD_API_BASE.replace(/\/$/, '');

// Helper to build headers
function buildRestHeaders(req: any) {
  const fromHeader = req.get('From') || PD_FROM_EMAIL;
  if (!fromHeader) {
    return null;
  }
  const headers: any = {
    Accept: 'application/vnd.pagerduty+json;version=2',
    'Content-Type': 'application/json',
    From: fromHeader,
  };
  const auth = req.get('Authorization');
  if (auth) {
    headers.Authorization = auth;
  }
  return headers;
}

async function proxyRequest(targetUrl: string, options: any, res: any) {
  try {
    const upstreamRes = await fetch(targetUrl, options);
    const body = await upstreamRes.text();
    const contentType = upstreamRes.headers.get('content-type');

    res.status(upstreamRes.status);
    if (contentType) {
      res.set('content-type', contentType);
    }
    res.send(body);
  } catch (err: any) {
    console.error('Proxy request failed:', err);
    res.status(500).json({ error: 'Proxy request failed', details: err.message });
  }
}

function restUrl(path: string) {
  return `${pdRestBase}${path}`;
}

function restBody(req: any) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return undefined;
  }
  return JSON.stringify(req.body);
}

// Events API
router.post('/events', async (req, res) => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: restBody(req),
  };
  await proxyRequest(PD_EVENTS_URL, options, res);
});

// Change Events API
router.post('/change_events', async (req, res) => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: restBody(req),
  };
  await proxyRequest(PD_CHANGE_EVENTS_URL, options, res);
});

// General REST Proxy
router.use(async (req, res) => {
  const headers = buildRestHeaders(req);
  if (!headers) {
    res.status(500).json({ error: 'PagerDuty REST requests require a From header.' });
    return;
  }
  
  const options: any = {
    method: req.method,
    headers,
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    options.body = restBody(req);
  }

  // Strip the '/proxy' prefix from the URL path
  const path = req.originalUrl.replace(/^\/proxy/, '');
  await proxyRequest(restUrl(path), options, res);
});

export default router;
