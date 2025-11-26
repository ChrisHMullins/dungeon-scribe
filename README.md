# Dungeon Scribe

D&D session audio transcription and entity tracking app.

## Prerequisites

- Node.js 18+
- Python 3.12+
- Whisper.cpp binaries (for transcription)
- Ollama (optional, for LLM features)

## Setup

### 1. Install Node dependencies

```bash
npm install
```

### 2. Set up the Stable Diffusion backend

```bash
cd sd-backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Download Whisper files

Create the whisper directories and download the required files:

```bash
mkdir -p resources/whisper/linux-x64
mkdir -p resources/whisper/models
```

Download whisper.cpp binaries for your platform and place them in `resources/whisper/linux-x64/` (or appropriate platform folder).

Download a whisper model (e.g., `ggml-base.bin`) and place it in `resources/whisper/models/`.

## Running

### Start the SD backend (in a separate terminal)

```bash
cd sd-backend
source venv/bin/activate
python server.py
```

### Start the app

```bash
npm start
```

Or for development with hot reload:

```bash
npm run dev
# Then in another terminal:
npm run electron
```
