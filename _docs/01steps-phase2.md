# Phase 2: Audio & Transcription ✅

## 2.1 Audio Capture ✅
- [x] Add audio input selector (choose microphone)
- [x] Implement recording controls (start/stop/pause)
- [x] Save audio to local file (WebM)
- [x] Show recording status and duration

## 2.2 File Upload Alternative
- [ ] Allow uploading pre-recorded audio files
- [ ] Support common formats (MP3, WAV, M4A, WebM)

## 2.3 Transcription Engine ✅
- [x] Integrate Whisper (local via whisper.cpp)
- [x] Convert WebM to WAV via ffmpeg
- [ ] Process audio in chunks for long sessions
- [ ] Display progress during transcription

## 2.4 Transcript Display ✅
- [x] Show transcript with timestamps
- [x] Transcripts page with session list
- [ ] Auto-scroll during live transcription
- [ ] Basic text formatting (speaker segments if detectable)

## 2.5 Storage ✅
- [x] Save transcripts to local JSON
- [x] Link transcript to session metadata
- [x] Load/display saved transcripts

---

## Technical Implementation

### Transcription: whisper.cpp (local, bundled)
- Binary + libs bundled in `resources/whisper/{platform}/`
- Model bundled in `resources/whisper/models/ggml-base.bin`
- Electron calls via `child_process.spawn()`
- Output: JSON with timestamps
- Works offline, free, private

### Audio Pipeline
1. Record via Web Audio API → WebM
2. Convert WebM → WAV (16kHz mono) via ffmpeg
3. Run whisper-cli on WAV
4. Parse JSON output, save as `.transcript.json`

### Current Limitations
- Requires ffmpeg on system (not bundled yet)
- No progress indicator during transcription
- No chunking for long sessions

---

## Dependencies
- Audio recording: Web Audio API (built-in)
- whisper.cpp: bundled binary + model
- ffmpeg: system dependency (TODO: bundle)
