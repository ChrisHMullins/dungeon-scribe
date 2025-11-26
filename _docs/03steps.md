# 03 Implementation Steps - Session UX Improvements

Based on `03plan.md` feedback, these updates improve the session recording and viewing experience.

---

## Summary of Changes

| Issue | Solution |
|-------|----------|
| Auto-starts recording on new session | Separate "Create Session" from "Start Recording" |
| Can't navigate while recording | Move recording state to global context |
| No control over entity detection | Add "Auto Detect Entities" checkbox |
| Live transcript disappears after session | Save transcript with entities to session |
| No way to view past sessions in detail | Create Session Detail page |
| Can't edit/correct transcription | Add transcript editor with audio playback |

---

## Phase 3A: Recording UX Improvements ✅

### 3A.1 Separate Session Creation from Recording ✅
- [x] Remove auto-record when session is created
- [x] Add "New Session" button (creates empty session)
- [x] Add "Start Recording" button (only enabled when session selected)
- [x] Allow selecting existing session for recording
- [x] Visual indicator for selected session

### 3A.2 Global Recording State
- [ ] Create `RecordingContext` (like CampaignContext)
- [ ] Move `useAudioRecorder` state to context
- [ ] Show recording indicator in sidebar/header when recording
- [ ] Allow navigation to other pages while recording continues
- [ ] Add mini recording controls (visible from any page)

### 3A.3 Auto Detect Entities Checkbox ✅
- [x] Add checkbox next to "Live Transcription"
- [x] Only run entity extraction when enabled
- [x] Shows warning when LLM offline

---

## Phase 3B: Transcript Persistence ✅

### 3B.1 Save Live Transcript on Session End ✅
- [x] When "End Session" clicked, save transcript to session folder
- [x] Include: chunks, text, timestamps, detected entities
- [x] Format: `transcript-live.json` with structure:
  ```json
  {
    "type": "live",
    "created": "2025-11-24T...",
    "chunks": [
      { "index": 0, "text": "...", "timestamp": "00:00", "entities": [...] }
    ],
    "entities": [{ "name": "Gandalf", "type": "character", ... }]
  }
  ```

### 3B.2 Multiple Transcript Versions ✅
- [x] Support multiple transcripts per session:
  - `transcript-live.json` (from live recording)
  - `transcript-v1.json` (first full re-transcription)
- [x] List transcripts in session detail view

---

## Phase 3C: Session Detail Page ✅

### 3C.1 Create Session Detail View ✅
- [x] New page: `SessionDetail.jsx`
- [x] Navigate here by clicking "view" button on session
- [x] Show session metadata (name, date)
- [x] Back button to return to sessions list

### 3C.2 Transcript Viewer ✅
- [x] List all transcript versions for session (sidebar)
- [x] Display selected transcript with:
  - Timestamps
  - Highlighted entities (colored by type)
  - Chunk boundaries
- [x] Switch between transcript versions
- [x] Show detected entities in sidebar

### 3C.3 Session Profiles Panel ✅
- [x] Show all entities detected in transcript sidebar
- [x] Color-coded by entity type

---

## Phase 3D: Transcript Editor (Partial)

### 3D.1 Audio Playback ✅
- [x] Load session audio file as data URL
- [x] Play button next to each transcript chunk
- [x] Click chunk → play that 12-second segment
- [x] Stop button to halt playback

### 3D.2 Text Editing
- [ ] Click chunk text to edit
- [ ] Save edits to new transcript version
- [ ] Track edit history
- [ ] "Save as new version" vs "Update current"

### 3D.3 Entity Correction
- [ ] Select text → "Mark as Entity" 
- [ ] Choose entity type (character/monster/place/item)
- [ ] Link to existing profile or create new
- [ ] Remove incorrect entity highlights

---

## File Changes

### New Files
- `src/renderer/context/RecordingContext.jsx` - Global recording state
- `src/renderer/pages/SessionDetail.jsx` - Session detail view
- `src/renderer/components/TranscriptViewer.jsx` - Display transcript
- `src/renderer/components/TranscriptEditor.jsx` - Edit transcript
- `src/renderer/components/AudioPlayer.jsx` - Chunk playback
- `src/renderer/components/RecordingIndicator.jsx` - Mini controls

### Modified Files
- `src/renderer/App.jsx` - Add RecordingContext, routing
- `src/renderer/pages/Sessions.jsx` - Refactor recording controls
- `src/main/main.js` - Transcript save/load handlers
- `src/main/preload.js` - New IPC methods

---

## Implementation Order

1. ✅ **3A.3** - Add "Auto Detect Entities" checkbox
2. ✅ **3B.1** - Save live transcript on session end
3. ✅ **3C.1-3C.2** - Session detail page with transcript viewer
4. ✅ **3A.1** - Separate create/record
5. ⏳ **3A.2** - Global recording state (deferred)
6. ✅ **3C.3** - Session profiles panel
7. ✅ **3D.1** - Audio playback for chunks
8. ⏳ **3D.2-3D.3** - Text editing & entity correction (deferred)

---

## MVP Scope

**Completed:**
- [x] Auto Detect Entities checkbox
- [x] Save transcript when session ends
- [x] Session detail page with transcript viewer
- [x] Basic chunk playback
- [x] Separate Create Session from Start Recording

**Deferred:**
- [ ] Global recording state (navigate while recording)
- [ ] Transcript text editing
- [ ] Entity correction UI

---

## Summary of Changes Made

1. **Sessions Page:**
   - Added "Auto Detect Entities" checkbox (disabled when LLM offline)
   - Separated "New Session" and "Start Recording" buttons
   - Click session to select for recording
   - View button (👁) opens session detail
   - Saves live transcript with entities on session end

2. **Session Detail Page (NEW):**
   - View all transcripts for a session
   - Highlighted entities in transcript text
   - Audio playback per chunk (play/stop)
   - Entity list sidebar with type colors

3. **New IPC Handlers:**
   - `save-live-transcript` - Save transcript data
   - `get-session-transcripts` - Load all transcripts for session
   - `get-session-audio` - Load audio as base64 data URL

