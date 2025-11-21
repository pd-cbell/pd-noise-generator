const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
const TEMPLATES_DIR = path.join(__dirname, 'templates');

const {
  PORT = 3001,
  PD_API_BASE = 'https://api.pagerduty.com',
  PD_FROM_EMAIL,
} = process.env;

const PD_EVENTS_URL = 'https://events.pagerduty.com/v2/enqueue';
const PD_CHANGE_EVENTS_URL = 'https://events.pagerduty.com/v2/change/enqueue';
const pdRestBase = PD_API_BASE.replace(/\/$/, '');

if (!PD_FROM_EMAIL) {
  console.warn('PD_FROM_EMAIL is not set. Provide it in .env or ensure each request includes a From header.');
}

function buildRestHeaders(req) {
  const fromHeader = req.get('From') || PD_FROM_EMAIL;
  if (!fromHeader) {
    return null;
  }
  const headers = {
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

const MAX_PROXY_RETRIES = 3;

function shouldRetry(err, attempt) {
  if (!err) return false;
  if (attempt >= MAX_PROXY_RETRIES) return false;
  return err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function proxyRequest(targetUrl, options, res, attempt = 1) {
  try {
    const upstreamRes = await fetch(targetUrl, options);
    const body = await upstreamRes.text();
    const contentType = upstreamRes.headers.get('content-type');

    if (!upstreamRes.ok) {
      const method = options?.method || 'GET';
      const trimmedBody = body && body.length > 500 ? `${body.slice(0, 500)}…` : body;
      const reqSummary = options?.body && typeof options.body === 'string' && options.body.length
        ? ` request=${options.body.slice(0, 500)}${options.body.length > 500 ? '…' : ''}`
        : '';
      console.error(`[proxy] ${method} ${targetUrl} -> ${upstreamRes.status}${reqSummary} response=${trimmedBody}`);
    }

    res.status(upstreamRes.status);
    if (contentType) {
      res.set('content-type', contentType);
    }
    res.send(body);
  } catch (err) {
    if (shouldRetry(err, attempt)) {
      const delay = 200 * attempt;
      console.warn(`[proxy] ${options?.method || 'GET'} ${targetUrl} attempt ${attempt} failed (${err.code}). Retrying in ${delay}ms.`);
      await wait(delay);
      await proxyRequest(targetUrl, options, res, attempt + 1);
      return;
    }
    console.error('Proxy request failed:', err);
    res.status(500).json({ error: 'Proxy request failed', details: err.message });
  }
}

function restUrl(req) {
  const path = req.originalUrl.replace(/^\/proxy/, '');
  return `${pdRestBase}${path}`;
}

function restBody(req) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return undefined;
  }
  return JSON.stringify(req.body);
}

app.post('/proxy/events', async (req, res) => {
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

app.post('/proxy/change_events', async (req, res) => {
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

async function handleRest(method, req, res) {
  const headers = buildRestHeaders(req);
  if (!headers) {
    res.status(500).json({ error: 'PagerDuty REST requests require a From header. Configure PD_FROM_EMAIL or include a From header in the request.' });
    return;
  }
  const options = {
    method,
    headers,
  };
  if (method !== 'GET' && method !== 'HEAD') {
    options.body = restBody(req);
  }
  await proxyRequest(restUrl(req), options, res);
}

app.get('/proxy/teams', (req, res) => handleRest('GET', req, res));
app.get('/proxy/services', (req, res) => handleRest('GET', req, res));
app.get('/proxy/services/:id/integrations', (req, res) => handleRest('GET', req, res));
app.get('/proxy/escalation_policies', (req, res) => handleRest('GET', req, res));
app.get('/proxy/incidents', (req, res) => handleRest('GET', req, res));
app.get('/proxy/users', (req, res) => handleRest('GET', req, res));
app.post('/proxy/incidents/:id/notes', (req, res) => handleRest('POST', req, res));
app.post('/proxy/incidents/:id/responder_requests', (req, res) => handleRest('POST', req, res));

app.get('/templates/index.json', async (req, res) => {
  try {
    const files = await fs.promises.readdir(TEMPLATES_DIR);
    const jsonFiles = files.filter((file) => file.toLowerCase().endsWith('.json'));
    res.json({ files: jsonFiles.map((file) => `/templates/${file}`) });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ files: [] });
    } else {
      console.error('Failed to read templates directory:', err);
      res.status(500).json({ error: 'Failed to read templates directory' });
    }
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PagerDuty proxy listening on port ${PORT}`);
});
