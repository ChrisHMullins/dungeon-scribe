# Phase A: Data Model Restructure

## Goal
Add Campaign as top-level entity. Sessions and Profiles belong to Campaigns.

## New Structure

```
~/.config/dungeon-scribe/
└── campaigns/
    └── {campaign-id}/
        ├── campaign.json       # name, created, settings
        ├── sessions/
        │   └── {session-id}/
        │       ├── session.json    # metadata
        │       ├── audio.webm
        │       ├── transcript.json
        │       └── images/
        └── profiles/
            └── {profile-id}/
                ├── profile.json    # name, type, description
                └── images/
```

## Tasks

### A.1 Campaign Management
- [ ] Create campaign data structure
- [ ] Add "Campaigns" page (list, create, select)
- [ ] Store active campaign in app state
- [ ] Update sidebar to show current campaign

### A.2 Migrate Sessions
- [ ] Move session storage under campaign folder
- [ ] Update IPC handlers for campaign context
- [ ] Sessions page shows sessions for active campaign only

### A.3 Add Profiles Entity
- [ ] Create profile data structure (name, type, description, images)
- [ ] Profile types: Character, NPC, Monster, Place, Item
- [ ] Add "Profiles" page (list, create, view, edit)
- [ ] Store profiles under campaign folder

### A.4 Update Navigation
- [ ] Campaign selector in header/sidebar
- [ ] "New Campaign" flow
- [ ] Show campaign name in UI

---

## Data Schemas

### campaign.json
```json
{
  "id": "uuid",
  "name": "Curse of Strahd",
  "created": "2025-11-24T...",
  "settings": {
    "imageGenEnabled": true
  }
}
```

### session.json
```json
{
  "id": "uuid",
  "campaignId": "uuid",
  "name": "Session 1",
  "created": "2025-11-24T...",
  "duration": 7200,
  "hasTranscript": true
}
```

### profile.json
```json
{
  "id": "uuid",
  "campaignId": "uuid",
  "name": "Strahd von Zarovich",
  "type": "NPC",
  "description": "Vampire lord of Barovia...",
  "aliases": ["Strahd", "The Count"],
  "created": "2025-11-24T...",
  "images": ["img1.png", "img2.png"]
}
```

---

## Files to Create/Modify

**New:**
- `src/renderer/pages/Campaigns.jsx`
- `src/renderer/pages/Profiles.jsx`
- `src/renderer/context/CampaignContext.jsx`

**Modify:**
- `src/main/main.js` – new IPC handlers
- `src/main/preload.js` – expose new methods
- `src/renderer/App.jsx` – campaign context, updated nav
- `src/renderer/pages/Sessions.jsx` – filter by campaign
- `src/renderer/pages/Transcripts.jsx` – filter by campaign

---

**Ready to build?**

