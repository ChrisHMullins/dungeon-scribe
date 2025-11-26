# Phase C: Local Stable Diffusion Image Generation ✅

## Goal
Generate images in real-time during D&D sessions and display them for players.

## Architecture

```
Electron App
    │
    ├── Main Process
    │   └── IPC handlers call SD backend via HTTP
    │
    └── Renderer
        ├── Present Mode (full-screen images)
        └── Images page (generate + gallery)
        
SD Backend (Python)
    └── FastAPI on localhost:7860
        └── SDXL Turbo via diffusers
```

---

## Tasks

### C.1 Python SD Backend ✅
- [x] Create Python script with FastAPI server
- [x] Load SD model on startup (SDXL Turbo)
- [x] `/generate` endpoint: prompt → image
- [x] Health check endpoint
- [ ] Auto-start from Electron (manual for now)

### C.2 Electron Integration ✅
- [x] IPC handler to call SD backend
- [x] Save images to session folder
- [x] Return base64 data to renderer
- [ ] Queue system for generation requests (not needed yet)

### C.3 Image Triggers
- [x] Manual "Generate Image" button (MVP)
- [ ] Keyword detection in transcript (Phase D)
- [ ] LLM prompt enhancement (Phase D)

### C.4 Present Mode ✅
- [x] Full-screen image display
- [x] Minimal UI (just the image)
- [x] Keyboard shortcuts (Esc to exit)
- [ ] Slideshow of recent images (later)

### C.5 Image Management ✅
- [x] Save images to session folder
- [x] Gallery view in Images page
- [ ] Associate images with profiles (Phase D)

---

## Implementation Notes

### PyTorch Setup
- **Version:** `torch==2.10.0.dev20251114+cu128` (nightly)
- **Reason:** RTX 5090 Blackwell requires nightly for CUDA kernel support
- **Install:** `pip install torch==2.10.0.dev20251114+cu128 --index-url https://download.pytorch.org/whl/nightly/cu128`

### CSP Fix
Added `img-src 'self' data:;` to Content Security Policy in `index.html` to allow base64 images.

### Files Created
- `sd-backend/server.py` – FastAPI server
- `sd-backend/requirements.txt` – Python deps
- `sd-backend/venv/` – Python virtual environment
- `src/renderer/pages/Images.jsx` – gallery + generate UI
- `src/renderer/components/PresentMode.jsx` – full-screen display

---

## Running the App

```bash
# Terminal 1: Vite dev server
npm run dev

# Terminal 2: SD Backend
cd sd-backend && source venv/bin/activate && python server.py

# Terminal 3: Electron
npm run electron
```

---

## Performance
- Image generation: ~1 second on RTX 5090
- Model: SDXL Turbo (1024x1024, 4 steps)
- VRAM usage: ~8GB
