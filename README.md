# Snap! Technical Atelier

Professional **visual programming IDE** (Snap!/Scratch-style) with a live **block runtime**, **project save/load**, and a **free multi-provider AI** assistant.

## What’s included

| Layer | Capability |
|--------|------------|
| **Block engine** | Drag from palette → canvas, snap stacks & C-block bodies, edit fields, double-click delete |
| **Stage VM** | Green flag / pause / stop / turbo; Motion, Control, Looks, Variables, Sound opcodes |
| **Persistence** | Autosave to `localStorage` + optional `PUT /api/projects/:id` on server |
| **AI** | Pollinations (no key) → Ollama → Groq → OpenRouter → custom |
| **Deploy** | Dockerfile, Railway, Fly.io |

## Quick start

```bash
git clone https://github.com/MichaelMatsobe/Snap-AI-CODING-.git
cd Snap-AI-CODING-
npm install
cp .env.example .env   # optional
npm run dev
```

Open **http://localhost:3000**

1. Drag blocks onto the workspace (demo project already has a bounce script).
2. Press the **green flag** on the stage — the rocket should move and bounce.
3. **Save** stores locally and to the API when online.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API `:3001` + Vite `:3000` |
| `npm run build` | Production frontend |
| `npm start` | Serve `dist` + API (production) |
| `npm run lint` | Typecheck |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health |
| GET/POST | `/api/ai/*` | Providers + chat |
| GET | `/api/projects` | List |
| GET/PUT/DELETE | `/api/projects/:id` | Load / save / delete |

## Deploy

### Railway

```bash
# Connect the GitHub repo in Railway UI, or:
npm i -g @railway/cli && railway login && railway init && railway up
```

Uses `Dockerfile` + `railway.toml` (health check `/api/health`).

### Fly.io

```bash
fly launch   # uses fly.toml
fly deploy
```

### Docker local

```bash
docker build -t snap-atelier .
docker run -p 3001:3001 -e NODE_ENV=production snap-atelier
# → http://localhost:3001
```

### Vercel note

The app is a **single Node server** (Express + static). Prefer Railway/Fly/Render. For Vercel you’d need to split API into serverless functions; not configured by default.

## Project layout

```
src/engine/     types, block defs, VM, project I/O, script graph
src/components/ Workspace, Stage, BlockView, AiAssistant
server/         Express, AI providers, project store
```

## Runtime notes

- Coordinates: Scratch-like, center origin, stage 480×360.
- `control_if` currently tests **touching stage edge**.
- Forever/repeat use a cooperative frame loop (`requestAnimationFrame`).
- Server project store is file-backed under `data/` (mount a volume in production for durability).

## License

Apache-2.0
