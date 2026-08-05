# Snap! Technical Atelier v1.3

Visual programming IDE (Scratch/Snap!-style) with live VM, nested reporters, TensorFlow.js webcam detection, SB3 import, AI script builder, and free multi-provider chat.

## Quick start

```bash
git pull && npm install && npm run dev
```

Open http://localhost:3000

## What was missing → now wired

| Gap | Status |
|-----|--------|
| Nested reporter sockets (UI + runtime) | **Done** — drop operators/sensing into number slots; VM uses `eval.ts` |
| True webcam + TensorFlow | **Done** — `@tensorflow/tfjs` + `coco-ssd` in `vision.ts`; panel + `ml_webcam_label` |
| Scratch `.sb3` import | **Done** — `Import SB3` button, `jszip` + `sb3Import.ts` |
| Control if/else with boolean plugs | **Done** — `boolCondition` + `CONDITION` input block |
| Input detach on delete | **Done** — cascade walks nested inputs |

## How to use the new pieces

### Nested reporters
1. Open **Operators** or **Sensing** in the palette.
2. Drag e.g. `pick random 1 to 10` onto a **number field** of `move … steps` (not only the canvas).
3. Green flag — the VM evaluates the nested block each step.

### Webcam COCO-SSD
1. Right panel → **Start webcam** → allow camera.
2. **COCO-SSD** runs client-side detection (downloads model on first use).
3. Labels fill `vision` variable and `objects` list; status bar shows top class.
4. Block **ML → webcam label → vision** does the same from a script.

### Import SB3
1. Header → **Import SB3** → choose a Scratch 3 `.sb3` file.
2. Sprites, scripts, variables/lists, and costume assets are converted into Atelier format.

## Stack

- React 19 + Vite + Express
- Free AI: Pollinations → Ollama → Groq → OpenRouter
- TF.js COCO-SSD (browser)
- JSZip SB3 loader
- Deploy: Docker / Railway / Fly

## Remaining product polish (not blockers)

- Full Scratch magnetic snap geometry / undo stack
- Boolean hexagon *shape* distinct from rounded reporters in UI
- All Scratch extensions (MIDI, Lego, etc.)
- Server-side durable DB beyond `data/projects.json`
- Export *to* SB3

## License

Apache-2.0
