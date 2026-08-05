# Snap! Technical Atelier

Professional-grade **visual programming IDE** with a **free multi-provider AI coding assistant**.

Built for commercial development: React + Vite frontend, Express API, automatic AI failover with no mandatory paid keys.

## Features

- Snap!/Scratch-style block IDE UI (palette, stage, sprites, inspector)
- **Snap! AI** chat assistant embedded in the IDE
- Free AI chain (no hard quotas on the primary path):
  1. **Pollinations** — no API key
  2. **Ollama** — local, unlimited
  3. **Groq** free tier (optional key)
  4. **OpenRouter** free models (optional key)
  5. **Custom** OpenAI-compatible endpoint
- Health endpoint + live status in the UI
- Production mode serves the Vite build from the same server

## Quick start

```bash
# clone
git clone https://github.com/MichaelMatsobe/Snap-AI-CODING-.git
cd Snap-AI-CODING-

# install
npm install

# env (optional — Pollinations works with zero config)
cp .env.example .env

# development (API on :3001, Vite on :3000 with /api proxy)
npm run dev
```

Open **http://localhost:3000**

### Scripts

| Command        | Description                          |
|----------------|--------------------------------------|
| `npm run dev`  | API + client concurrently            |
| `npm run client` | Vite only                          |
| `npm run server` | API only (`tsx watch`)             |
| `npm run build`  | Production frontend build          |
| `npm start`      | Production: serve `dist` + API     |
| `npm run lint`   | Typecheck                          |

## AI setup

**Zero-config:** the server calls [text.pollinations.ai](https://text.pollinations.ai) first. No key required.

**Unlimited local:** install [Ollama](https://ollama.com), pull a model, leave defaults:

```bash
ollama pull llama3.2
```

**Optional keys** in `.env` for higher throughput:

- `GROQ_API_KEY` — https://console.groq.com
- `OPENROUTER_API_KEY` — https://openrouter.ai (prefer `:free` models)

## API

| Method | Path               | Description                |
|--------|--------------------|----------------------------|
| GET    | `/api/health`      | Liveness                   |
| GET    | `/api/ai/providers`| Provider availability      |
| POST   | `/api/ai/chat`     | Chat completion (failover) |

Example:

```bash
curl -s http://localhost:3001/api/health
curl -s -X POST http://localhost:3001/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Explain the move steps block"}]}'
```

## Project layout

```
src/
  App.tsx                 # IDE shell
  components/AiAssistant.tsx
  lib/api.ts              # Frontend API client
server/
  index.ts                # Express app
  ai/providers.ts         # Free provider chain
  ai/chat.ts              # Failover logic
  ai/types.ts
```

## Commercial readiness notes

- Environment-based config; secrets never committed (`.env` in `.gitignore`)
- CORS configurable; production can serve static + API on one port
- Provider failover so a single free endpoint outage does not break the product
- TypeScript strict mode; `npm run lint` for CI

Next product milestones: real block drag-and-drop runtime, project persistence, multiplayer, and authenticated workspaces.

## License

Apache-2.0
