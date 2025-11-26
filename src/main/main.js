const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const llm = require('./llm');

const isDev = !app.isPackaged;

// Get platform-specific whisper paths
function getWhisperPaths() {
  const platform = process.platform;
  const arch = process.arch;
  const platformKey = `${platform}-${arch}`;
  
  const resourcesPath = isDev 
    ? path.join(__dirname, '../../resources/whisper')
    : path.join(process.resourcesPath, 'whisper');
  
  const binaryName = platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  
  return {
    binary: path.join(resourcesPath, platformKey, binaryName),
    libDir: path.join(resourcesPath, platformKey),
    model: path.join(resourcesPath, 'models', 'ggml-base.bin'),
  };
}

// Data directories
const baseDataDir = path.join(app.getPath('userData'), 'data');
const campaignsDir = path.join(baseDataDir, 'campaigns');

// Ensure directories exist
if (!fs.existsSync(campaignsDir)) {
  fs.mkdirSync(campaignsDir, { recursive: true });
}

// Helper: generate UUID
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper: get campaign path
function getCampaignPath(campaignId) {
  return path.join(campaignsDir, campaignId);
}

// Helper: get sessions path for campaign
function getSessionsPath(campaignId) {
  return path.join(getCampaignPath(campaignId), 'sessions');
}

// Helper: get profiles path for campaign
function getProfilesPath(campaignId) {
  return path.join(getCampaignPath(campaignId), 'profiles');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ===================
// Campaign IPC Handlers
// ===================

ipcMain.handle('get-campaigns', async () => {
  try {
    if (!fs.existsSync(campaignsDir)) {
      return { success: true, campaigns: [] };
    }
    const dirs = fs.readdirSync(campaignsDir, { withFileTypes: true });
    const campaigns = dirs
      .filter((d) => d.isDirectory())
      .map((d) => {
        const configPath = path.join(campaignsDir, d.name, 'campaign.json');
        if (fs.existsSync(configPath)) {
          return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    return { success: true, campaigns };
  } catch (err) {
    return { success: false, error: err.message, campaigns: [] };
  }
});

ipcMain.handle('create-campaign', async (event, name) => {
  try {
    const id = generateId();
    const campaignPath = getCampaignPath(id);
    fs.mkdirSync(campaignPath, { recursive: true });
    fs.mkdirSync(path.join(campaignPath, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(campaignPath, 'profiles'), { recursive: true });
    
    const campaign = {
      id,
      name,
      created: new Date().toISOString(),
      settings: { imageGenEnabled: true },
    };
    
    fs.writeFileSync(
      path.join(campaignPath, 'campaign.json'),
      JSON.stringify(campaign, null, 2)
    );
    
    return { success: true, campaign };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-campaign', async (event, campaignId) => {
  try {
    const campaignPath = getCampaignPath(campaignId);
    if (fs.existsSync(campaignPath)) {
      fs.rmSync(campaignPath, { recursive: true });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ===================
// Session IPC Handlers (Campaign-scoped)
// ===================

ipcMain.handle('save-audio-file', async (event, campaignId, buffer) => {
  try {
    const sessionsPath = getSessionsPath(campaignId);
    if (!fs.existsSync(sessionsPath)) {
      fs.mkdirSync(sessionsPath, { recursive: true });
    }
    
    const sessionId = generateId();
    const sessionDir = path.join(sessionsPath, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    
    const audioPath = path.join(sessionDir, 'audio.webm');
    fs.writeFileSync(audioPath, Buffer.from(buffer));
    
    const session = {
      id: sessionId,
      campaignId,
      name: `Session ${new Date().toLocaleDateString()}`,
      created: new Date().toISOString(),
      hasTranscript: false,
      path: sessionDir,
    };
    
    fs.writeFileSync(
      path.join(sessionDir, 'session.json'),
      JSON.stringify(session, null, 2)
    );
    
    return { success: true, session, audioPath };
  } catch (err) {
    console.error('Failed to save audio:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-sessions', async (event, campaignId) => {
  try {
    const sessionsPath = getSessionsPath(campaignId);
    if (!fs.existsSync(sessionsPath)) {
      return { success: true, sessions: [] };
    }
    
    const dirs = fs.readdirSync(sessionsPath, { withFileTypes: true });
    const sessions = dirs
      .filter((d) => d.isDirectory())
      .map((d) => {
        const sessionPath = path.join(sessionsPath, d.name, 'session.json');
        if (fs.existsSync(sessionPath)) {
          const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
          session.path = path.join(sessionsPath, d.name);
          session.audioPath = path.join(sessionsPath, d.name, 'audio.webm');
          return session;
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return { success: true, sessions };
  } catch (err) {
    return { success: false, error: err.message, sessions: [] };
  }
});

ipcMain.handle('get-transcript', async (event, sessionPath) => {
  try {
    const transcriptPath = path.join(sessionPath, 'transcript.json');
    if (!fs.existsSync(transcriptPath)) {
      return { success: false, error: 'No transcript found' };
    }
    const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
    return { success: true, transcript };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-session', async (event, sessionPath) => {
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to delete session:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-session-audio', async (event, sessionPath, buffer) => {
  try {
    // Find the next available recording number
    let recordingNum = 1;
    const files = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath) : [];
    const existingRecordings = files
      .filter(f => f.startsWith('recording-') && f.endsWith('.webm'))
      .map(f => {
        const match = f.match(/recording-(\d+)\.webm/);
        return match ? parseInt(match[1]) : 0;
      });
    
    if (existingRecordings.length > 0) {
      recordingNum = Math.max(...existingRecordings) + 1;
    }
    
    const audioPath = path.join(sessionPath, `recording-${recordingNum}.webm`);
    fs.writeFileSync(audioPath, Buffer.from(buffer));
    
    // Also update/keep audio.webm as the latest for backward compatibility
    const latestPath = path.join(sessionPath, 'audio.webm');
    fs.writeFileSync(latestPath, Buffer.from(buffer));
    
    return { success: true, recordingNumber: recordingNum };
  } catch (err) {
    console.error('Failed to update session audio:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-live-transcript', async (event, sessionPath, transcriptData) => {
  try {
    // Find the next available transcript number
    let transcriptNum = 1;
    const files = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath) : [];
    const existingTranscripts = files
      .filter(f => f.startsWith('transcript-') && f.endsWith('.json'))
      .map(f => {
        const match = f.match(/transcript-(\d+)\.json/);
        return match ? parseInt(match[1]) : 0;
      });
    
    if (existingTranscripts.length > 0) {
      transcriptNum = Math.max(...existingTranscripts) + 1;
    }
    
    const transcriptPath = path.join(sessionPath, `transcript-${transcriptNum}.json`);
    fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));
    
    // Also save as transcript-live.json for backward compatibility (latest)
    const latestPath = path.join(sessionPath, 'transcript-live.json');
    fs.writeFileSync(latestPath, JSON.stringify(transcriptData, null, 2));
    
    // Update session.json to mark it has a transcript
    const sessionJsonPath = path.join(sessionPath, 'session.json');
    if (fs.existsSync(sessionJsonPath)) {
      const session = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf-8'));
      session.hasTranscript = true;
      session.hasLiveTranscript = true;
      fs.writeFileSync(sessionJsonPath, JSON.stringify(session, null, 2));
    }
    
    return { success: true, transcriptNumber: transcriptNum };
  } catch (err) {
    console.error('Failed to save live transcript:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-session-transcripts', async (event, sessionPath) => {
  try {
    const transcripts = [];
    const files = fs.readdirSync(sessionPath);
    
    for (const file of files) {
      // Include transcript-N.json files, exclude transcript-live.json (it's a duplicate)
      if (file.startsWith('transcript-') && file.endsWith('.json') && file !== 'transcript-live.json') {
        const filePath = path.join(sessionPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        data.filename = file;
        transcripts.push(data);
      }
    }
    
    // Sort by created date (newest first)
    transcripts.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return { success: true, transcripts };
  } catch (err) {
    console.error('Failed to get session transcripts:', err);
    return { success: false, error: err.message, transcripts: [] };
  }
});

ipcMain.handle('get-session-audio', async (event, sessionPath, recordingNumber) => {
  try {
    let audioPath;
    
    if (recordingNumber) {
      // Load specific recording
      audioPath = path.join(sessionPath, `recording-${recordingNumber}.webm`);
    } else {
      // Default to latest (audio.webm for backward compatibility)
      audioPath = path.join(sessionPath, 'audio.webm');
    }
    
    console.log('Loading audio from:', audioPath, 'recordingNumber:', recordingNumber);
    
    if (!fs.existsSync(audioPath)) {
      console.log('Audio file not found:', audioPath);
      return { success: false, error: 'Audio file not found' };
    }
    
    const audioBuffer = fs.readFileSync(audioPath);
    const base64 = audioBuffer.toString('base64');
    console.log('Audio file loaded, size:', audioBuffer.length, 'bytes, base64 length:', base64.length);
    
    // Try with codec specified (Opus is the default for WebM audio)
    return { success: true, audioData: `data:audio/webm;codecs=opus;base64,${base64}` };
  } catch (err) {
    console.error('Failed to get session audio:', err);
    return { success: false, error: err.message };
  }
});

// ===================
// Profile IPC Handlers
// ===================

ipcMain.handle('get-profiles', async (event, campaignId) => {
  try {
    const profilesPath = getProfilesPath(campaignId);
    if (!fs.existsSync(profilesPath)) {
      return { success: true, profiles: [] };
    }
    
    const dirs = fs.readdirSync(profilesPath, { withFileTypes: true });
    const profiles = dirs
      .filter((d) => d.isDirectory())
      .map((d) => {
        const profilePath = path.join(profilesPath, d.name, 'profile.json');
        if (fs.existsSync(profilePath)) {
          const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
          profile.path = path.join(profilesPath, d.name);
          return profile;
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return { success: true, profiles };
  } catch (err) {
    return { success: false, error: err.message, profiles: [] };
  }
});

ipcMain.handle('create-profile', async (event, campaignId, profileData) => {
  try {
    const profilesPath = getProfilesPath(campaignId);
    if (!fs.existsSync(profilesPath)) {
      fs.mkdirSync(profilesPath, { recursive: true });
    }
    
    const id = generateId();
    const profileDir = path.join(profilesPath, id);
    fs.mkdirSync(profileDir, { recursive: true });
    fs.mkdirSync(path.join(profileDir, 'images'), { recursive: true });
    
    const profile = {
      id,
      campaignId,
      name: profileData.name,
      type: profileData.type || 'NPC',
      description: profileData.description || '',
      aliases: profileData.aliases || [],
      created: new Date().toISOString(),
      images: [],
    };
    
    fs.writeFileSync(
      path.join(profileDir, 'profile.json'),
      JSON.stringify(profile, null, 2)
    );
    
    return { success: true, profile };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-profile', async (event, campaignId, profileId, updates) => {
  try {
    const profilePath = path.join(getProfilesPath(campaignId), profileId, 'profile.json');
    if (!fs.existsSync(profilePath)) {
      return { success: false, error: 'Profile not found' };
    }
    
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
    Object.assign(profile, updates, { updated: new Date().toISOString() });
    
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    
    return { success: true, profile };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-profile', async (event, campaignId, profileId) => {
  try {
    const profileDir = path.join(getProfilesPath(campaignId), profileId);
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ===================
// Transcription Handler
// ===================

ipcMain.handle('transcribe-audio', async (event, sessionPath) => {
  const whisper = getWhisperPaths();
  const audioPath = path.join(sessionPath, 'audio.webm');
  
  // Check if whisper binary exists
  if (!fs.existsSync(whisper.binary)) {
    return { success: false, error: `Whisper binary not found: ${whisper.binary}` };
  }
  if (!fs.existsSync(whisper.model)) {
    return { success: false, error: `Whisper model not found: ${whisper.model}` };
  }
  if (!fs.existsSync(audioPath)) {
    return { success: false, error: `Audio file not found: ${audioPath}` };
  }

  try {
    // Convert webm to wav using ffmpeg
    const wavPath = path.join(sessionPath, 'audio.wav');
    
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', '-i', audioPath,
        '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
        wavPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on('error', reject);
    });

    // Run whisper
    const result = await new Promise((resolve, reject) => {
      const outputPrefix = path.join(sessionPath, 'whisper-out');
      const args = [
        '-m', whisper.model,
        '-f', wavPath,
        '-oj', // Output JSON
        '-of', outputPrefix,
      ];
      
      const env = { ...process.env };
      env.LD_LIBRARY_PATH = `${whisper.libDir}:${env.LD_LIBRARY_PATH || ''}`;
      
      const whisperProc = spawn(whisper.binary, args, { env });
      
      let stdout = '';
      let stderr = '';
      
      whisperProc.stdout.on('data', (data) => { stdout += data; });
      whisperProc.stderr.on('data', (data) => { stderr += data; });
      
      whisperProc.on('close', (code) => {
        if (code === 0) {
          // Read the JSON output file
          const jsonPath = `${outputPrefix}.json`;
          let transcript;
          if (fs.existsSync(jsonPath)) {
            transcript = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          } else {
            transcript = { transcription: [{ text: stdout }] };
          }
          
          // Save transcript in session folder
          const transcriptPath = path.join(sessionPath, 'transcript.json');
          fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));
          
          // Update session.json
          const sessionJsonPath = path.join(sessionPath, 'session.json');
          if (fs.existsSync(sessionJsonPath)) {
            const session = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf-8'));
            session.hasTranscript = true;
            fs.writeFileSync(sessionJsonPath, JSON.stringify(session, null, 2));
          }
          
          resolve({ success: true, transcript });
        } else {
          reject(new Error(`Whisper failed: ${stderr}`));
        }
      });
      whisperProc.on('error', reject);
    });

    return result;
  } catch (err) {
    console.error('Transcription failed:', err);
    return { success: false, error: err.message };
  }
});

// Transcribe an audio chunk (for live transcription)
ipcMain.handle('transcribe-chunk', async (event, audioBuffer, sessionPath, chunkIndex) => {
  const whisper = getWhisperPaths();
  
  if (!fs.existsSync(whisper.binary)) {
    return { success: false, error: 'Whisper binary not found' };
  }
  if (!fs.existsSync(whisper.model)) {
    return { success: false, error: 'Whisper model not found' };
  }

  try {
    // Create chunks directory
    const chunksDir = path.join(sessionPath, 'chunks');
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }
    
    // Save chunk as webm
    const chunkWebm = path.join(chunksDir, `chunk-${chunkIndex}.webm`);
    const chunkWav = path.join(chunksDir, `chunk-${chunkIndex}.wav`);
    fs.writeFileSync(chunkWebm, Buffer.from(audioBuffer));
    
    // Convert to wav
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', '-i', chunkWebm,
        '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
        chunkWav
      ]);
      let ffmpegStderr = '';
      ffmpeg.stderr.on('data', (data) => { ffmpegStderr += data.toString(); });
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error('ffmpeg stderr:', ffmpegStderr);
          reject(new Error(`ffmpeg failed with code ${code}`));
        }
      });
      ffmpeg.on('error', reject);
    });

    // Run whisper
    const result = await new Promise((resolve, reject) => {
      const args = [
        '-m', whisper.model,
        '-f', chunkWav,
        '-oj',
        '-of', path.join(chunksDir, `chunk-${chunkIndex}`),
      ];
      
      const env = { ...process.env };
      env.LD_LIBRARY_PATH = `${whisper.libDir}:${env.LD_LIBRARY_PATH || ''}`;
      
      const whisperProc = spawn(whisper.binary, args, { env });
      
      let stderr = '';
      whisperProc.stderr.on('data', (data) => { stderr += data; });
      
      whisperProc.on('close', (code) => {
        if (code === 0) {
          const jsonPath = path.join(chunksDir, `chunk-${chunkIndex}.json`);
          let text = '';
          if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            text = data.transcription?.map(s => s.text).join(' ') || '';
          }
          resolve({ success: true, text, chunkIndex });
        } else {
          reject(new Error(`Whisper failed: ${stderr}`));
        }
      });
      whisperProc.on('error', reject);
    });

    return result;
  } catch (err) {
    console.error('Chunk transcription failed:', err);
    return { success: false, error: err.message };
  }
});

// ===================
// Image Generation (SD Backend)
// ===================

const SD_BACKEND_URL = 'http://127.0.0.1:7860';
let sdProcess = null;

ipcMain.handle('sd-check-health', async () => {
  try {
    const response = await fetch(`${SD_BACKEND_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, ...data };
    }
    return { success: false, error: 'SD backend not responding' };
  } catch (err) {
    return { success: false, error: 'SD backend not running' };
  }
});

ipcMain.handle('sd-generate-image', async (event, prompt, options = {}) => {
  try {
    const response = await fetch(`${SD_BACKEND_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: options.negativePrompt || 'blurry, low quality, distorted',
        width: options.width || 1024,
        height: options.height || 1024,
        steps: options.steps || 4,
        seed: options.seed || -1,
      }),
    });
    
    const data = await response.json();
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-generated-image', async (event, campaignId, sessionId, imageBase64, metadata = {}) => {
  try {
    const sessionsPath = getSessionsPath(campaignId);
    const sessionDir = path.join(sessionsPath, sessionId);
    const imagesDir = path.join(sessionDir, 'images');
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const imageId = generateId();
    const imagePath = path.join(imagesDir, `${imageId}.png`);
    
    // Decode base64 and save
    const buffer = Buffer.from(imageBase64, 'base64');
    fs.writeFileSync(imagePath, buffer);
    
    // Save metadata
    const imageData = {
      id: imageId,
      path: imagePath,
      prompt: metadata.prompt || '',
      seed: metadata.seed || 0,
      chunkIndex: metadata.chunkIndex,
      chunkText: metadata.chunkText || '',
      timestamp: metadata.timestamp || '',
      created: new Date().toISOString(),
    };
    
    const metaPath = path.join(imagesDir, `${imageId}.json`);
    fs.writeFileSync(metaPath, JSON.stringify(imageData, null, 2));
    
    return { success: true, image: imageData };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-session-images', async (event, campaignId, sessionId) => {
  try {
    const imagesDir = path.join(getSessionsPath(campaignId), sessionId, 'images');
    
    if (!fs.existsSync(imagesDir)) {
      return { success: true, images: [] };
    }
    
    const files = fs.readdirSync(imagesDir);
    const images = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const data = JSON.parse(fs.readFileSync(path.join(imagesDir, f), 'utf-8'));
        // Read image and convert to data URL
        if (fs.existsSync(data.path)) {
          const imageBuffer = fs.readFileSync(data.path);
          data.url = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        }
        return data;
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return { success: true, images };
  } catch (err) {
    return { success: false, error: err.message, images: [] };
  }
});

ipcMain.handle('delete-session-image', async (event, campaignId, sessionId, imageId) => {
  try {
    const imagesDir = path.join(getSessionsPath(campaignId), sessionId, 'images');
    const imagePath = path.join(imagesDir, `${imageId}.png`);
    const metaPath = path.join(imagesDir, `${imageId}.json`);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ===================
// LLM IPC Handlers
// ===================

ipcMain.handle('llm-check-health', async () => {
  return await llm.checkHealth();
});

ipcMain.handle('extract-entities', async (event, text) => {
  try {
    const entities = await llm.extractEntities(text);
    return { success: true, entities };
  } catch (err) {
    return { success: false, error: err.message, entities: [] };
  }
});

ipcMain.handle('generate-image-prompt', async (event, entity) => {
  try {
    const prompt = await llm.generateImagePrompt(entity);
    return { success: true, prompt };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('generate-scene-prompt', async (event, sceneText) => {
  try {
    const prompt = await llm.generateScenePrompt(sceneText);
    return { success: true, prompt };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Process entities: check for new ones, create profiles, generate images
ipcMain.handle('process-entities', async (event, campaignId, entities, generateImages = true) => {
  try {
    const profilesPath = getProfilesPath(campaignId);
    if (!fs.existsSync(profilesPath)) {
      fs.mkdirSync(profilesPath, { recursive: true });
    }
    
    // Load existing profiles
    const existingProfiles = [];
    if (fs.existsSync(profilesPath)) {
      const files = fs.readdirSync(profilesPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const profile = JSON.parse(fs.readFileSync(path.join(profilesPath, file), 'utf-8'));
          existingProfiles.push(profile);
        }
      }
    }
    
    const existingNames = new Set(existingProfiles.map(p => p.name.toLowerCase()));
    const newProfiles = [];
    
    for (const entity of entities) {
      // Check if profile already exists (case-insensitive)
      if (existingNames.has(entity.name.toLowerCase())) {
        continue;
      }
      
      // Create new profile
      const profileId = generateId();
      const profile = {
        id: profileId,
        campaignId,
        name: entity.name,
        type: entity.type,
        description: entity.description,
        created: new Date().toISOString(),
        autoGenerated: true,
      };
      
      // Save profile
      fs.writeFileSync(
        path.join(profilesPath, `${profileId}.json`),
        JSON.stringify(profile, null, 2)
      );
      
      existingNames.add(entity.name.toLowerCase());
      newProfiles.push(profile);
      
      // Generate image for new profile (async, don't block)
      if (generateImages) {
        generateProfileImage(campaignId, profileId, entity).catch(err => {
          console.error(`Failed to generate image for ${entity.name}:`, err);
        });
      }
    }
    
    return { success: true, newProfiles, totalProcessed: entities.length };
  } catch (err) {
    console.error('Failed to process entities:', err);
    return { success: false, error: err.message, newProfiles: [] };
  }
});

// Helper: Generate image for a profile
async function generateProfileImage(campaignId, profileId, entity) {
  try {
    // Generate image prompt using LLM
    const prompt = await llm.generateImagePrompt(entity);
    console.log(`Generating image for ${entity.name}: ${prompt}`);
    
    // Call SD backend
    const sdResponse = await fetch('http://127.0.0.1:7860/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, num_steps: 4, seed: -1 }),
    });
    
    if (!sdResponse.ok) {
      throw new Error(`SD generation failed: ${sdResponse.status}`);
    }
    
    const sdData = await sdResponse.json();
    
    // Save image to profile
    const profilesPath = getProfilesPath(campaignId);
    const imagesDir = path.join(profilesPath, profileId, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const imageId = generateId();
    const imagePath = path.join(imagesDir, `${imageId}.png`);
    const imageBuffer = Buffer.from(sdData.image, 'base64');
    fs.writeFileSync(imagePath, imageBuffer);
    
    // Update profile with image
    const profilePath = path.join(profilesPath, `${profileId}.json`);
    if (fs.existsSync(profilePath)) {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
      profile.imagePath = imagePath;
      profile.imagePrompt = prompt;
      fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    }
    
    console.log(`Image generated for ${entity.name}: ${imagePath}`);
  } catch (err) {
    console.error(`Image generation failed for ${entity.name}:`, err);
  }
}

