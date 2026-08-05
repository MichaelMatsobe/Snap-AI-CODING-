# Snap! Technical Atelier v1.3.1

Visual programming IDE (Scratch/Snap!-style) with live VM, nested reporters, TensorFlow.js webcam detection, SB3 import, AI script builder, and free multi-provider chat.

## Quick start

```bash
git pull && npm install && npm run dev
```

Open http://localhost:3000

## Feature matrix

| Capability | Status |
|------------|--------|
| Nested reporter sockets (UI + runtime, multi-level) | **Done** — drop operators/sensing into slots; nested drops work inside reporters |
| True webcam + TensorFlow COCO-SSD | **Done** — `@tensorflow/tfjs` + `coco-ssd`; panel + `ml_webcam_label` |
| Scratch `.sb3` import (sprites + stage scripts) | **Done** — `Import SB3`, JSZip, stage scripts as Stage sprite |
| Control if / if-else with boolean plugs | **Done** — CONDITION input + else branch UI (`branch2`) |
| Variable / motion / size reporters | **Done** — `data_variable`, `motion_xposition`, `motion_yposition`, `motion_direction`, `looks_size` |
| Boolean hexagon-ish sockets | **Done** — distinct clip-path styling |
| Clones, pen, AI/ML blocks | **Done** |
| Free AI failover chain | **Done** — Pollinations → Ollama → Groq → OpenRouter |

## How to use

### Nested reporters (multi-level)
1. **Operators** → drag `pick random 1 to 10` onto the number field of `move … steps`.
2. Drag another operator onto a socket *inside* that random block (e.g. nest further).
3. Green flag — VM evaluates the full tree each step via `eval.ts`.

### if / else
1. Control → `if … then else`.
2. Drop a boolean into the condition slot.
3. Drop stacks into **then** and **else** bodies.

### Webcam COCO-SSD
1. Right panel → **Start webcam** → allow camera.
2. **COCO-SSD** runs client-side (model downloads on first use).
3. Labels → `vision` variable + `objects` list; or use **ML → webcam label**.

### Import SB3
1. Header → **Import SB3** → choose a Scratch 3 `.sb3`.
2. Sprites, stage scripts (as Stage), variables/lists, costumes are converted.

## Stack

- React 19 + Vite + Express
- Free AI: Pollinations → Ollama → Groq → OpenRouter
- TF.js COCO-SSD (browser)
- JSZip SB3 loader
- Deploy: Docker / Railway / Fly

## Remaining polish (not blockers)

- Full Scratch magnetic snap geometry / undo stack
- Export *to* SB3
- All Scratch hardware extensions (MIDI, Lego, …)
- Server-side durable DB beyond file/json store

## License

Apache-2.0
