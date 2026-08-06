# Snap! Technical Atelier

A professional visual programming IDE (Scratch / Snap!-style) with a live block interpreter, nested reporter sockets, TensorFlow.js webcam object detection, Scratch `.sb3` import, and a **free multi-provider AI coding assistant** that can build real block scripts from plain English.

> **v1.4.0** — React 19 + Vite + Express · Apache-2.0

![Stack](https://img.shields.io/badge/React_19-Vite_6-7cd2f1) ![AI](https://img.shields.io/badge/AI-Pollinations_·_Ollama_·_Groq_·_OpenRouter-88db60)

---

## What it is

- **Block IDE** — drag Motion / Looks / Sound / Events / Control / Sensing / Operators / Variables / Lists / Pen / AI / ML blocks onto the canvas, snap them into stacks, C-bodies (`repeat`, `forever`, `if/else`) and nested reporter sockets.
- **Live VM** — a TypeScript interpreter (`src/engine/vm.ts` + `src/engine/eval.ts`) runs your project: clones, lists, pen trails, variables, broadcasts, key/sprite-click events, timers, and Turbo mode.
- **AI assistant** — chat in the right panel. Say *“build a script that spins forever”* and real blocks are injected onto the active sprite. Free failover chain: **Pollinations → Ollama → Groq → OpenRouter → custom endpoint**.
- **Computer vision** — start the webcam and run **COCO-SSD** (TensorFlow.js, in-browser) to write detections into the `vision` variable and `objects` list, or use the `webcam label` ML block.
- **Scratch import** — open `.sb3` files (JSZip): sprites, stage scripts, variables, lists and costumes are converted.
- **Costume editor** — paint 128×128 costumes (brush / eraser / color picker).

## Quick start

```bash
npm install
npm run dev          # API on :3001, web on http://localhost:3000
```

Open **http://localhost:3000**. `npm run dev` runs the Express API (`/api/*`) and the Vite client together; Vite proxies `/api` to `:3001`.

The app also works with zero configuration — Pollinations needs **no API key** and is tried first.

### Works in any browser, installable & offline

- **Any browser** — the IDE is a responsive web app (Scratch/Snap!-style). On phones and tablets it switches to a **Blocks / Stage** tab layout, and you can **tap a palette block, then tap the canvas** to place it (drag & drop stays available on desktop).
- **Install it (PWA)** — the app ships a web app manifest + service worker:
  - **Android / Chrome** — open the app, then *Install app* / *Add to Home screen*.
  - **iOS / Safari** — *Share → Add to Home Screen* (opens standalone, full-screen).
  - **Desktop** — the *Install* icon in the browser address bar (Chrome/Edge) adds it as a standalone window.
- **Offline** — after the first visit the app shell and assets are cached by the service worker, so the whole IDE (block editor, VM, costumes, `.sb3` import, localStorage projects) keeps working with no connection. Only the AI assistant and webcam ML need network (the AI API and the first TensorFlow.js download).

The PWA icons can be regenerated anytime with `node scripts/generate-icons.mjs` (zero dependencies).

## Environment variables

Copy `.env.example` to `.env` (all values optional).

| Variable | Purpose | Default |
|---|---|---|
| `PORT` / `API_PORT` | API server port (`API_PORT` wins) | `3001` |
| `NODE_ENV` | `production` enables static hosting of `dist/` | `development` |
| `DATA_DIR` | Folder for the JSON project store (`data/projects.json`) | `./data` |
| `CORS_ORIGINS` | Allowed dev origins (comma-separated) | `http://localhost:3000,http://127.0.0.1:3000` |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq free tier (no card required) | `llama-3.3-70b-versatile` |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | OpenRouter (use `:free` models) | `openrouter/auto` |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Local Ollama (truly unlimited) | `http://127.0.0.1:11434` / `llama3.2` |
| `CUSTOM_AI_BASE_URL` / `CUSTOM_AI_API_KEY` / `CUSTOM_AI_MODEL` | Any OpenAI-compatible endpoint | — |

The provider failover is fully automatic: each request walks the chain and uses the first provider that responds.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (`tsx watch`) + Vite client together |
| `npm run client` | Vite dev server only (honors `$PORT`) |
| `npm run server` | Express API only (pinned to `:3001` via `API_PORT`) |
| `npm run build` | Production build to `dist/` |
| `npm run start` | Serve `dist/` + API from Express (`NODE_ENV=production`) |
| `npm run lint` | `tsc --noEmit` typecheck |

## Architecture

```
src/
  engine/          # Pure logic — no React
    blocks.ts      # Block catalogue (12 categories), palette colors
    types.ts       # Project / block / sprite / VM snapshot types
    project.ts     # Default project, local (localStorage) persistence
    scripts.ts     # Stack/attach/detach/delete graph operations
    vm.ts          # Stage VM: threads, clones, events, pen, AI/ML hooks
    eval.ts        # Nested reporter & boolean evaluation
    vmEvalBridge.ts# Connects vm.ts <-> eval.ts
    sb3Import.ts   # Scratch .sb3 (ZIP + project.json) converter
    scriptBuilder.ts # AI JSON -> block graph + heuristic fallback
    vision.ts      # Webcam + TensorFlow.js COCO-SSD
  components/      # BlockView, Workspace, Stage, AiAssistant,
                   # CostumeEditor, ImportSb3Button, WebcamPanel, SettingsModal
  lib/
    api.ts         # Typed client for the /api endpoints
server/
  index.ts         # Express: /api/health, /api/ai/*, /api/projects/*, static dist
  ai/              # Pollinations / Ollama / Groq / OpenRouter / custom, failover chain
  projects.ts      # In-memory + JSON-file project store
```

## Key flows

- **Nested reporters** — drag an operator/sensing reporter onto a number or boolean socket; the VM evaluates the whole tree each step (`eval.ts`). Nesting is unlimited.
- **if / else** — `control_if_else` renders a then-body and an else-body drop zone.
- **AI builds scripts** — the assistant sends the block JSON schema as its system prompt, then parses a fenced `JSON` block from the reply and injects it. If the API is unreachable, a heuristic builder still produces a simple script from keywords.
- **Webcam ML** — `vision.ts` lazily loads COCO-SSD; detections land in `vision` / `objects`; `ml_webcam_label` exposes it as a block.
- **Clones & pen** — `control_create_clone_of` / `control_start_as_clone` / `control_delete_this_clone`; pen trails render on the stage SVG.
- **Ask & answer** — `sensing_askandwait` pauses the script and opens an in-app answer dialog (no browser popup), then stores the reply in the `answer` variable.

## Deployment

Three supported targets (all run the Express server that also serves `dist/`):

- **Docker** — `docker build -t snap-ai-coding . && docker run -p 3001:3001 snap-ai-coding` (the image runs `tsx server/index.ts` in `NODE_ENV=production`).
- **Railway** — `railway.toml` (Dockerfile builder, `/api/health` check).
- **Fly.io** — `fly.toml` (internal port `3001`, `/api/health` check).

> Static-only hosts (e.g. plain Vite static output) will run the IDE fine, but the AI chat / health endpoints need the Express API — use one of the targets above for the full experience.

## Feature matrix

| Capability | Status |
|---|---|
| Nested reporter sockets (multi-level, UI + runtime) | ✅ |
| Webcam + TensorFlow COCO-SSD (`ml_webcam_label`, `vision`/`objects`) | ✅ |
| Scratch `.sb3` import (sprites + stage scripts) | ✅ |
| Control if / if-else with boolean plugs | ✅ |
| Variable / motion / size reporters | ✅ |
| Boolean hexagon sockets | ✅ |
| Clones, pen, AI/ML blocks | ✅ |
| Free AI failover (Pollinations → Ollama → Groq → OpenRouter → custom) | ✅ |
| `when this sprite clicked` / `when key pressed` start from idle | ✅ |
| AI provider status panel (⚙️ in header) | ✅ |
| In-app `ask and wait` dialog (no `window.prompt`) | ✅ |
| Imported Scratch stage backdrops (full-stage render + stage scripts) | ✅ |
| PWA: installable standalone app + offline (manifest + service worker) | ✅ |
| Mobile layout with Blocks / Stage tabs and tap-to-place blocks | ✅ |

## Known limitations

- Magnetic snap geometry and a full undo stack are not implemented (blocks attach via drop zones).
- On touch devices, dragging blocks to *snap them into stacks* is not implemented — use tap-to-place and field editing instead; stack building via drag is desktop-only.
- Export *to* `.sb3` is not implemented.
- Layer ordering (`go to front/back` layer) and real sound synthesis are not modeled — sound blocks show a status note instead of audio.
- Hardware extensions (MIDI, LEGO, …) are out of scope.
- Project persistence is localStorage + a simple JSON file store (no multi-user DB).

## License

Apache-2.0
