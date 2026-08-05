# Snap! Technical Atelier

Professional **visual programming IDE** with a live **Scratch/Snap!-style runtime**, **costume editor**, **cloning**, **AI/ML blocks**, and an assistant that **builds real block scripts** from natural language.

## Run

```bash
git pull && npm install && npm run dev
```

Open http://localhost:3000 — press the **green flag**, try **AI → “Build spin forever”**.

## Block library

Categories: **Motion, Looks, Sound, Events, Control, Sensing, Operators, Variables, Lists, Pen, AI, ML**

Includes Scratch 3-inspired opcodes plus:

| AI | ML / Vision |
|----|-------------|
| `ai_ask` / `ai_complete` | `ml_classify_image` |
| `ai_classify_text` | `ml_describe_scene` |
| `ai_summarize` | `ml_detect_objects` |
| `ai_build_script` | `ml_webcam_label` |
| | `ml_similarity` / `ml_predict_number` |

AI/ML stack blocks call the free multi-provider backend (Pollinations → Ollama → …) and write results into variables/lists.

## Runtime features

- **Drag-and-drop** palette → canvas, stack + C-block bodies
- **Green flag / pause / stop / turbo**
- **Cloning**: `create clone of`, `when I start as a clone`, `delete this clone`
- **Broadcast** receive/send
- **Lists**, **pen** trails, **costumes** (switch / next)
- **Costume editor**: brush/eraser, save as data-URL costume
- **Key hats** (keyboard events)
- **Project autosave** (localStorage) + `PUT /api/projects/:id`

## AI builds blocks

In the AI panel, say e.g. *“Build a script that spins forever”*.

1. Model is prompted to return JSON block graphs.
2. Parser injects a real stack onto the **active sprite**.
3. If the API is offline, a **heuristic builder** still places a sensible stack.

## Deploy

`Dockerfile`, `railway.toml`, `fly.toml` — see earlier README notes. Production: `npm run build && npm start`.

## Layout

```
src/engine/     blocks, VM, project, scriptBuilder
src/components/ Workspace, Stage, CostumeEditor, AiAssistant
server/         Express, AI providers, project store
```

## Limits (honest)

- Boolean/reporter blocks are palette-visible; conditions in `if` are **string expressions** (e.g. `touching edge`, `score > 10`), not nested reporter plugs.
- Webcam vision uses AI description of the stage, not a local TensorFlow model (plug-in ready via `ml_*` opcodes).
- Not every Scratch extension (video sensing hardware, MIDI, etc.) is emulated.

## License

Apache-2.0
