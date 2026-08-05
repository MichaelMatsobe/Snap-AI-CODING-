/**
 * Snap! Technical Atelier — API server
 * Free multi-provider AI coding assistant + static production hosting
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatCompletion, listProviders } from './ai/chat.js';
import type { ChatMessage } from './ai/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3001;

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
app.use(express.json({ limit: '2mb' }));

// ── Health ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'snap-ai-coding',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
  });
});

// ── AI providers status ─────────────────────────────────────────────
app.get('/api/ai/providers', async (_req, res) => {
  try {
    const providers = await listProviders();
    res.json({ providers });
  } catch (err) {
    console.error('[providers]', err);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

// ── Chat completions (free multi-provider failover) ─────────────────
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
Help users design scripts, explain blocks (Motion, Looks, Sound, Pen, Events, Control, Sensing, Operators, Variables, Lists, My Blocks), generate pseudocode or block sequences, debug logic, and suggest project structure.
Be concise, practical, and friendly. When suggesting blocks, use clear names like "move 10 steps" or "when green flag clicked".`,
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

// ── Production: serve Vite build ────────────────────────────────────
if (isProd) {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Snap! Technical Atelier API`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  → AI: Pollinations (no key) → Ollama → Groq → OpenRouter → custom\n`);
});
