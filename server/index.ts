/**
 * Snap! Technical Atelier — API server
 * Free multi-provider AI + project persistence + static hosting
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { chatCompletion, listProviders } from './ai/chat.js';
import type { ChatMessage } from './ai/types.js';
import {
  listProjects,
  getProject,
  upsertProject,
  deleteProject,
} from './projects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
// API_PORT wins so the bundled dev/preview run can keep the API on a fixed
// internal port while the web frontend takes the externally injected PORT.
const PORT = Number(process.env.API_PORT || process.env.PORT) || 3001;

const execAsync = promisify(exec);
// In-app terminal tool. Disable for public/multi-user deployments with
// ENABLE_TERMINAL=0 — it executes shell commands on the host.
const ENABLE_TERMINAL = process.env.ENABLE_TERMINAL !== '0';

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: isProd ? true : corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '16mb' })); // projects embed base64 costumes

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'snap-ai-coding',
    version: '1.5.0',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
  });
});

app.get('/api/ai/providers', async (_req, res) => {
  try {
    const providers = await listProviders();
    res.json({ providers });
  } catch (err) {
    console.error('[providers]', err);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, system, temperature, max_tokens } = req.body as {
      messages?: ChatMessage[];
      system?: string;
      temperature?: number;
      max_tokens?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const result = await chatCompletion({
      messages,
      system:
        system ||
        `You are Snap! AI, the coding assistant inside Snap! Technical Atelier — a professional visual block-based programming IDE (inspired by Snap!/Scratch).
Help users design scripts, explain blocks, generate block sequences, debug logic, and suggest project structure.
Be concise and practical.`,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 1024,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    console.error('[chat]', message);
    res.status(502).json({ error: message });
  }
});

// ── Projects ────────────────────────────────────────────────────────
app.get('/api/projects', (_req, res) => {
  res.json({ projects: listProjects() });
});

app.get('/api/projects/:id', (req, res) => {
  const row = getProject(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(row);
});

app.put('/api/projects/:id', (req, res) => {
  const { name, data } = req.body as { name?: string; data?: unknown };
  if (!data) {
    res.status(400).json({ error: 'data required' });
    return;
  }
  const row = upsertProject({
    id: req.params.id,
    name: name || 'Untitled',
    data,
  });
  res.json(row);
});

app.delete('/api/projects/:id', (req, res) => {
  const ok = deleteProject(req.params.id);
  res.json({ ok });
});

// ── In-app terminal (background console for the AI assistant) ────────────
// Runs a single shell command in the project root, returns output + exit code.
// Stateless by design (each call starts fresh from the repo root).
const DEV_SERVER_RE =
  /(npm run (dev|client|server|start|preview|preview:prod)\b)|(\bvite\s*$)|(\bvite\s+(dev|serve|preview)\b)|(concurrently\b)|(\btsx\s+watch\b)/i;

app.post('/api/terminal/exec', async (req, res) => {
  if (!ENABLE_TERMINAL) {
    res.status(403).json({ error: 'Terminal tool is disabled (set ENABLE_TERMINAL=1 to enable it)' });
    return;
  }
  const { command } = (req.body || {}) as { command?: string };
  if (typeof command !== 'string' || !command.trim()) {
    res.status(400).json({ error: 'command is required' });
    return;
  }
  if (command.length > 2000) {
    res.status(400).json({ error: 'command too long (max 2000 chars)' });
    return;
  }
  if (DEV_SERVER_RE.test(command.trim())) {
    res.status(400).json({
      error:
        'Refusing to start a dev server from the console — the Freebuff platform owns the preview lifecycle. ' +
        'Use "freebuff-preview status" to inspect, or start the preview from the platform UI.',
    });
    return;
  }

  const started = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: path.join(__dirname, '..'), // project root
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    res.json({
      command,
      exitCode: 0,
      stdout: stdout.slice(0, 20_000),
      stderr: stderr.slice(0, 20_000),
      killed: false,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string; killed?: boolean };
    res.json({
      command,
      exitCode: typeof e.code === 'number' ? e.code : 1,
      stdout: (e.stdout || '').slice(0, 20_000),
      stderr: (e.stderr || '').slice(0, 20_000),
      killed: Boolean(e.killed),
      durationMs: Date.now() - started,
    });
  }
});

if (isProd) {
  const dist = path.join(__dirname, '..', 'dist');
  // Some mime tables shipped with older Express don't know .webmanifest — send
  // the correct type so browsers accept the PWA manifest.
  app.use('/manifest.webmanifest', (_req, res, next) => {
    res.type('application/manifest+json');
    next();
  });
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Snap! Technical Atelier API v1.5.0`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → env: ${process.env.NODE_ENV || 'development'}\n`);
});
