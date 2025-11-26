# Dungeon Scribe – Implementation Steps

## Phase 1: Project Setup ✅
- [x] Choose stack (Electron + React)
- [x] Initialize project with minimal dependencies
- [x] Create basic UI shell with navigation

## Phase 2: Audio & Transcription ✅
- [x] Implement audio capture (microphone)
- [x] Integrate speech-to-text (Whisper local via whisper.cpp)
- [x] Display transcript with timestamps

## Phase 3: Entity Extraction
- [ ] Parse transcript for D&D entities (character names, places, monsters)
- [ ] Use LLM or rule-based extraction
- [ ] Tag and highlight entities in transcript

## Phase 4: Profile Management
- [ ] Store extracted entities in local DB (SQLite or JSON)
- [ ] Create/view/edit profile pages for each entity type
- [ ] Link mentions back to transcript timestamps

## Phase 5: Image Generation
- [ ] Integrate image gen API (DALL-E, Stable Diffusion, etc.)
- [ ] Generate scene images from transcript excerpts
- [ ] Associate images with sessions/entities

## Phase 6: Polish
- [ ] Session management (save, load, export)
- [ ] Search across transcripts and profiles
- [ ] Settings and preferences

---

## Decisions Made
- **Stack:** Electron + React + Vite
- **Transcription:** whisper.cpp (local, bundled)
- **Model:** ggml-base.bin (~142MB, bundled)
- **Audio format:** WebM recording, converted to WAV for Whisper
- **Storage:** JSON files in user data directory
