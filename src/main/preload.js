const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Campaigns
  getCampaigns: () => ipcRenderer.invoke('get-campaigns'),
  createCampaign: (name) => ipcRenderer.invoke('create-campaign', name),
  deleteCampaign: (campaignId) => ipcRenderer.invoke('delete-campaign', campaignId),
  
  // Sessions
  saveAudioFile: (campaignId, buffer) => ipcRenderer.invoke('save-audio-file', campaignId, buffer),
  getSessions: (campaignId) => ipcRenderer.invoke('get-sessions', campaignId),
  getTranscript: (sessionPath) => ipcRenderer.invoke('get-transcript', sessionPath),
  transcribeAudio: (sessionPath) => ipcRenderer.invoke('transcribe-audio', sessionPath),
  transcribeChunk: (buffer, sessionPath, chunkIndex) => 
    ipcRenderer.invoke('transcribe-chunk', buffer, sessionPath, chunkIndex),
  deleteSession: (sessionPath) => ipcRenderer.invoke('delete-session', sessionPath),
  updateSessionAudio: (sessionPath, buffer) => ipcRenderer.invoke('update-session-audio', sessionPath, buffer),
  saveLiveTranscript: (sessionPath, data) => ipcRenderer.invoke('save-live-transcript', sessionPath, data),
  getSessionTranscripts: (sessionPath) => ipcRenderer.invoke('get-session-transcripts', sessionPath),
  getSessionAudio: (sessionPath, recordingNumber) => ipcRenderer.invoke('get-session-audio', sessionPath, recordingNumber),
  
  // Profiles
  getProfiles: (campaignId) => ipcRenderer.invoke('get-profiles', campaignId),
  createProfile: (campaignId, data) => ipcRenderer.invoke('create-profile', campaignId, data),
  updateProfile: (campaignId, profileId, updates) => ipcRenderer.invoke('update-profile', campaignId, profileId, updates),
  deleteProfile: (campaignId, profileId) => ipcRenderer.invoke('delete-profile', campaignId, profileId),
  
  // Image Generation
  sdCheckHealth: () => ipcRenderer.invoke('sd-check-health'),
  sdGenerateImage: (prompt, options) => ipcRenderer.invoke('sd-generate-image', prompt, options),
  saveGeneratedImage: (campaignId, sessionId, imageBase64, metadata) =>
    ipcRenderer.invoke('save-generated-image', campaignId, sessionId, imageBase64, metadata),
  getSessionImages: (campaignId, sessionId) => ipcRenderer.invoke('get-session-images', campaignId, sessionId),
  deleteSessionImage: (campaignId, sessionId, imageId) =>
    ipcRenderer.invoke('delete-session-image', campaignId, sessionId, imageId),
  
  // LLM / Entity Extraction
  llmCheckHealth: () => ipcRenderer.invoke('llm-check-health'),
  extractEntities: (text) => ipcRenderer.invoke('extract-entities', text),
  generateImagePrompt: (entity) => ipcRenderer.invoke('generate-image-prompt', entity),
  generateScenePrompt: (sceneText) => ipcRenderer.invoke('generate-scene-prompt', sceneText),
  processEntities: (campaignId, entities) => ipcRenderer.invoke('process-entities', campaignId, entities),
});
