# Phase D: Profile Auto-Detection

## Goal
Automatically detect entities (characters, monsters, places, items) from live transcript, create profiles, and generate images.

## Flow

```
Chunk Transcribed
      ↓
Send to LLM (LM Studio)
      ↓
Extract Entities [{name, type, description}]
      ↓
Check against existing profiles
      ↓
New entity? → Create profile → Generate image (SD)
      ↓
Highlight in transcript UI
```

## LLM Setup

**Primary: LM Studio** (local, OpenAI-compatible API)
- Default endpoint: `http://localhost:1234/v1`
- Uses OpenAI chat completions format
- User loads their preferred model in LM Studio

**Future options (marked with comments):**
- OpenAI API (cloud)
- Ollama (local)
- Standalone local model (llama.cpp)

## Entity Types

| Type | Color | Example |
|------|-------|---------|
| Character | Blue | Gandalf, Thorin |
| Monster | Red | Goblin King, Dragon |
| Place | Green | Mirkwood, Lonely Mountain |
| Item | Gold | Ring of Power, Sting |

## Extraction Prompt

```
You are analyzing a D&D game transcript. Extract named entities.

Return JSON array:
[
  {"name": "Gandalf", "type": "character", "description": "wise wizard"},
  {"name": "Mirkwood", "type": "place", "description": "dark forest"}
]

Types: character, monster, place, item
Only include proper nouns (named things), not generic terms.
Transcript chunk:
---
{transcript_text}
---
```

## Tasks

### D.1 LLM Client
- [ ] Create LLM service module
- [ ] Connect to LM Studio API
- [ ] Entity extraction function
- [ ] Error handling (LM Studio not running)

### D.2 Extraction Pipeline
- [ ] Hook into chunk transcription flow
- [ ] Parse LLM response
- [ ] Dedupe against existing profiles
- [ ] Handle LLM latency (don't block UI)

### D.3 Auto Profile Creation
- [ ] Create profile from entity
- [ ] Generate image prompt from entity
- [ ] Trigger SD image generation
- [ ] Save image to profile

### D.4 Transcript UI
- [ ] Highlight entities inline
- [ ] Color by type
- [ ] Clickable to view profile
- [ ] Show "new profile created" indicator

---

## Files to Create/Modify

- `src/main/llm.js` - LLM client module (NEW)
- `src/main/main.js` - extraction IPC handlers
- `src/main/preload.js` - expose LLM functions
- `src/renderer/pages/Sessions.jsx` - highlighted transcript
- `src/renderer/components/EntityHighlight.jsx` - inline entity component (NEW)

---

## API Design

### IPC: `extract-entities`
```js
// Request
{ text: "The party meets Gandalf in Rivendell..." }

// Response
{ 
  success: true, 
  entities: [
    { name: "Gandalf", type: "character", description: "..." },
    { name: "Rivendell", type: "place", description: "..." }
  ]
}
```

### IPC: `llm-check-health`
```js
// Response
{ status: "ready", model: "llama-3.1-8b" }
// or
{ status: "offline", error: "LM Studio not running" }
```

---

## MVP Scope

Build:
- LM Studio integration
- Entity extraction after each chunk
- Auto profile creation
- Basic transcript highlighting

Defer:
- Entity merging (same entity mentioned differently)
- Confidence scores
- Manual entity correction
- Batch re-analysis

