# Dungeon Scribe v2 – Real-Time Image Display

## New Data Model

```
Campaign
├── Sessions[]
│   ├── Transcripts[] (takes/versions)
│   └── Images[]
└── Profiles[]
    ├── Details (name, type, description)
    └── Images[]
```

## Key Pivot from v1

| v1 (Current) | v2 (New Direction) |
|--------------|-------------------|
| Record → Stop → Transcribe | Continuous real-time listening |
| Transcribe button | "New Take" for versioning |
| Transcript-focused | Image-focused display |
| Manual profile creation | Auto-detect entities, generate images |
| View transcripts after | Live display during gameplay |

---

## Implementation Phases

### Phase A: Data Model Restructure ✅
- [x] Add Campaign entity (name, created, settings)
- [x] Refactor Sessions to belong to Campaign
- [x] Add Profiles at Campaign level
- [x] Link Images to Sessions

### Phase B: Real-Time Transcription ✅
- [x] Continuous audio streaming (chunk-based, 12-sec intervals)
- [x] Stream to Whisper in chunks (auto-transcribes each chunk)
- [x] "New Take" button clears transcript for fresh start
- [x] Live transcript display (auto-updating with timestamps)
- [x] Mic level indicator for audio feedback
- [x] Delete session functionality

### Phase C: Image Generation Pipeline ✅
- [x] Generate images via Local Stable Diffusion (SDXL Turbo)
- [x] Display images prominently (full-screen present mode)
- [x] Save images to session folders
- [ ] Detect "image moments" in transcript (Phase D)
- [ ] Queue system for generation (not needed yet)

### Phase D: Profile Auto-Detection
- [ ] Use LLM to extract entities from transcript
- [ ] Match against existing profiles (fuzzy name matching)
- [ ] If new → create profile + generate image
- [ ] If existing → reuse profile image (or generate new variant)

### Phase E: Display Mode
- [ ] "Presentation mode" for players to see
- [ ] Large image display, minimal UI
- [ ] Slideshow of recent images
- [ ] Optional: second window for player display

---

## Suggestions for Steering Development

### 1. Image Generation Backend
**Options:**
- **Local Stable Diffusion** (free, private, needs GPU)
- **OpenAI DALL-E** (easy API, costs money)
- **Replicate API** (SD via API, moderate cost)

**Recommendation:** Start with DALL-E for simplicity, add local SD later.

### 2. Real-Time Transcription
**Current approach won't work** – whisper.cpp processes files, not streams.

**Options:**
- **Whisper streaming** (whisper.cpp has experimental stream mode)
- **Chunk-based** – record 10-second chunks, transcribe each
- **Cloud API** – OpenAI Whisper API supports streaming

**Recommendation:** Chunk-based with local Whisper (keeps privacy, works now).

### 3. Image Moment Detection
**Approaches:**
- **Keyword triggers** – "fight", "treasure", "describe", etc.
- **LLM analysis** – send transcript chunk to GPT, ask "is this image-worthy?"
- **Hybrid** – keywords for fast triggers, LLM for better prompts

**Recommendation:** Start with keywords + LLM for prompt generation.

### 4. Display Architecture
**For players to see images:**
- **Option A:** Single window with "present mode" toggle
- **Option B:** Two windows (DM view + player display)
- **Option C:** Web server mode (players view on phones/tablets)

**Recommendation:** Start with single window present mode, add multi-window later.

---

## Immediate Next Steps

1. **Restructure data model** (Campaign → Sessions → Transcripts)
2. **Implement chunk-based live transcription** (replace record/stop)
3. **Add image generation** (DALL-E API first)
4. **Create "present mode"** for image display

---

## Decisions Made

- [x] **Image generation:** Local Stable Diffusion (free, private)
- [x] **Display:** Single window with mode toggle
- [x] **SD model:** SDXL Turbo (fast, ~1 sec/image)
- [x] **PyTorch:** Nightly cu128 for RTX 5090 Blackwell support
- [ ] How often to trigger image generation? (Every scene? On keyword? Manual?)

