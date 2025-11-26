import React, { useState, useEffect, useRef } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useRecording } from '../context/RecordingContext';

// Entity type colors
const ENTITY_COLORS = {
  character: '#60a5fa',
  monster: '#f87171',
  place: '#4ade80',
  item: '#fbbf24',
};

// Highlight entities in text
function HighlightedText({ text, entities }) {
  if (!entities || entities.length === 0) {
    return <span>{text}</span>;
  }

  const entityMap = {};
  entities.forEach(e => {
    entityMap[e.name.toLowerCase()] = e;
  });
  
  const pattern = entities
    .map(e => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  
  if (!pattern) return <span>{text}</span>;
  
  const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isEntity: false });
    }
    const entity = entityMap[match[0].toLowerCase()];
    parts.push({ text: match[0], isEntity: true, entity });
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isEntity: false });
  }

  return (
    <span>
      {parts.map((part, idx) => 
        part.isEntity ? (
          <span
            key={idx}
            style={{
              color: ENTITY_COLORS[part.entity?.type] || '#fff',
              fontWeight: 'bold',
            }}
            title={`${part.entity?.type}: ${part.entity?.description}`}
          >
            {part.text}
          </span>
        ) : (
          <span key={idx}>{part.text}</span>
        )
      )}
    </span>
  );
}

export default function SessionDetail({ session, onBack }) {
  const { activeCampaign } = useCampaign();
  const recording = useRecording();
  const [transcripts, setTranscripts] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [audioData, setAudioData] = useState(null);
  const [playingChunk, setPlayingChunk] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [parsingEntities, setParsingEntities] = useState(new Set());
  const [currentRecordingNumber, setCurrentRecordingNumber] = useState(null);
  const audioRef = useRef(null);
  const stopTimeoutRef = useRef(null);
  const blobUrlRef = useRef(null);
  const wasRecordingRef = useRef(false);

  useEffect(() => {
    loadTranscripts();
    // Don't load audio here - will load when transcript is selected
    return () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Clean up blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [session]);

  // Load audio when transcript changes
  useEffect(() => {
    if (selectedTranscript) {
      console.log('Loading audio for transcript:', selectedTranscript.filename);
      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingChunk(null);
      loadAudio(selectedTranscript);
    } else {
      console.log('No transcript selected, clearing audio');
      // Stop playback and clear audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingChunk(null);
      setAudioData(null);
      setCurrentRecordingNumber(null);
    }
  }, [selectedTranscript]);

  // Refresh transcripts when recording stops
  useEffect(() => {
    if (wasRecordingRef.current && !recording.isRecording && session) {
      // Recording just stopped, refresh transcripts
      setTimeout(() => {
        loadTranscripts();
      }, 500); // Small delay to ensure file is written
    }
    wasRecordingRef.current = recording.isRecording;
  }, [recording.isRecording, session]);

  // Reset ready state when audioData changes
  useEffect(() => {
    if (audioData && audioRef.current) {
      setAudioReady(false);
      // Force reload
      audioRef.current.load();
    }
  }, [audioData]);

  const loadTranscripts = async () => {
    if (!session?.path) return;
    const result = await window.electronAPI.getSessionTranscripts(session.path);
    if (result.success) {
      setTranscripts(result.transcripts);
      if (result.transcripts.length > 0) {
        // Preserve selected transcript if it still exists, otherwise select first (newest)
        setSelectedTranscript(prev => {
          if (prev && prev.filename) {
            const stillExists = result.transcripts.find(t => t.filename === prev.filename);
            if (stillExists) {
              return stillExists; // Keep selected, but use updated object
            }
          }
          // Select first (newest) transcript
          const firstTranscript = result.transcripts[0];
          console.log('Selecting initial transcript:', firstTranscript.filename);
          return firstTranscript;
        });
      } else {
        setSelectedTranscript(null);
      }
    }
  };

  const loadAudio = async (transcript) => {
    if (!session?.path) return;
    
    // Clear audio data first to ensure clean state
    setAudioData(null);
    setCurrentRecordingNumber(null);
    setAudioLoading(true);
    setAudioReady(false);
    
    // Clean up previous blob URL if it exists
    if (blobUrlRef.current) {
      console.log('Revoking previous blob URL:', blobUrlRef.current);
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    
    try {
      // Extract recording number from transcript filename (transcript-N.json -> N)
      let recordingNumber = null;
      if (transcript?.filename) {
        const match = transcript.filename.match(/transcript-(\d+)\.json/);
        if (match) {
          recordingNumber = parseInt(match[1]);
          console.log('Extracted recording number:', recordingNumber, 'from filename:', transcript.filename);
        } else {
          console.log('Could not extract recording number from filename:', transcript.filename);
        }
      } else {
        console.log('No filename in transcript, using default audio');
      }
      
      console.log('Requesting audio for session:', session.path, 'recording:', recordingNumber);
      const result = await window.electronAPI.getSessionAudio(session.path, recordingNumber);
      if (result.success && result.audioData) {
        // Convert base64 data URL to Blob without using fetch (CSP blocks fetch on data URLs)
        // Extract base64 string from data URL
        const base64Match = result.audioData.match(/base64,(.+)$/);
        if (!base64Match) {
          throw new Error('Invalid data URL format');
        }
        
        const base64 = base64Match[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob from bytes
        const blob = new Blob([bytes], { type: 'audio/webm' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        
        console.log('Audio blob created, URL:', blobUrl, 'for recording', recordingNumber, 'blob size:', blob.size);
        setCurrentRecordingNumber(recordingNumber);
        setAudioData(blobUrl);
        // Reset ready state - will be set when audio loads
        setAudioReady(false);
      } else {
        // No audio file exists (empty session) - handle gracefully
        console.log('No audio file found for this transcript');
        setAudioData(null);
        setCurrentRecordingNumber(null);
      }
    } catch (err) {
      // Handle errors gracefully - don't show alert for missing audio
      console.error('Failed to load audio:', err);
      setAudioData(null);
      setCurrentRecordingNumber(null);
    } finally {
      setAudioLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const playChunk = async (chunk) => {
    if (!audioData || !audioRef.current) {
      console.error('Audio not loaded');
      return;
    }
    
    if (!audioReady || audioRef.current.readyState < 2) {
      console.log('Waiting for audio to load...', audioRef.current?.readyState);
      return;
    }
    
    try {
      // Calculate start time based on chunk index (12 seconds per chunk)
      const startTime = chunk.index * 12;
      const duration = audioRef.current.duration;
      
      if (startTime >= duration) {
        console.warn(`Start time ${startTime}s exceeds audio duration ${duration}s`);
        return;
      }
      
      // Clear any existing timeout
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
      
      // Set the start time and play
      audioRef.current.currentTime = startTime;
      await audioRef.current.play();
      setPlayingChunk(chunk.index);
      
      // Calculate actual stop time (don't exceed duration)
      const stopTime = Math.min(startTime + 12, duration);
      const playDuration = (stopTime - startTime) * 1000;
      
      // Stop after chunk duration
      stopTimeoutRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setPlayingChunk(null);
        stopTimeoutRef.current = null;
      }, playDuration);
    } catch (err) {
      console.error('Failed to play audio:', err);
      setPlayingChunk(null);
      alert(`Failed to play audio: ${err.message}`);
    }
  };

  const stopPlayback = () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingChunk(null);
  };

  const handleAudioLoaded = () => {
    if (audioRef.current && audioRef.current.readyState >= 2) {
      setAudioReady(true);
      console.log('Audio loaded and ready, duration:', audioRef.current.duration);
    }
  };

  const handleAudioError = (e) => {
    console.error('Audio error:', e);
    console.error('Audio element:', audioRef.current);
    console.error('Audio src:', audioRef.current?.src);
    setAudioReady(false);
    const errorMsg = audioRef.current?.error 
      ? `Code ${audioRef.current.error.code}: ${audioRef.current.error.message}`
      : 'Unknown error';
    alert(`Failed to load audio: ${errorMsg}. WebM/Opus may not be supported.`);
  };

  const handleParseEntities = async (chunk) => {
    if (!activeCampaign || !selectedTranscript || !chunk.text) return;
    
    setParsingEntities(prev => new Set(prev).add(chunk.index));
    
    try {
      // Check LLM health
      const llmStatus = await window.electronAPI.llmCheckHealth();
      if (llmStatus.status !== 'ready') {
        alert('LLM is not available. Please start LM Studio.');
        return;
      }
      
      // Extract entities from chunk text
      const entityResult = await window.electronAPI.extractEntities(chunk.text);
      if (entityResult.success && entityResult.entities.length > 0) {
        // Process entities (create/update profiles)
        const processResult = await window.electronAPI.processEntities(
          activeCampaign.id,
          entityResult.entities
        );
        
        if (processResult.success) {
          // Update the transcript with new entities
          const updatedTranscript = {
            ...selectedTranscript,
            entities: [
              ...(selectedTranscript.entities || []),
              ...entityResult.entities.filter(newEntity => 
                !selectedTranscript.entities?.some(existing => 
                  existing.name.toLowerCase() === newEntity.name.toLowerCase()
                )
              )
            ]
          };
          
          // Update transcript in the list
          setTranscripts(prev => prev.map(t => 
            t.id === selectedTranscript.id ? updatedTranscript : t
          ));
          setSelectedTranscript(updatedTranscript);
        }
      } else {
        alert('No entities found in this segment.');
      }
    } catch (err) {
      console.error('Failed to parse entities:', err);
      alert(`Failed to parse entities: ${err.message}`);
    } finally {
      setParsingEntities(prev => {
        const next = new Set(prev);
        next.delete(chunk.index);
        return next;
      });
    }
  };

  if (!session) {
    return (
      <div style={styles.container}>
        <p>No session selected</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Hidden audio element */}
      <audio
        key={`${selectedTranscript?.filename || 'no-transcript'}-${currentRecordingNumber || 'none'}`}
        ref={audioRef}
        src={audioData || undefined}
        preload="metadata"
        onLoadedMetadata={handleAudioLoaded}
        onCanPlay={handleAudioLoaded}
        onError={handleAudioError}
        style={{ display: 'none' }}
      />
      
      <div style={styles.content}>
        {/* Transcripts List */}
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Transcripts</h3>
          {transcripts.length === 0 ? (
            <p style={styles.placeholder}>No transcripts yet</p>
          ) : (
            <div style={styles.transcriptList}>
              {transcripts.map((t) => (
                <div
                  key={t.filename || t.created}
                  style={{
                    ...styles.transcriptItem,
                    ...(selectedTranscript?.filename === t.filename ? styles.transcriptItemActive : {}),
                  }}
                  onClick={() => {
                    console.log('Transcript clicked:', t.filename);
                    setSelectedTranscript(t);
                  }}
                >
                  <div style={styles.transcriptType}>
                    {t.type === 'live' ? '🎙️ Live' : '📝 Transcribed'}
                  </div>
                  <div style={styles.transcriptMeta}>
                    {new Date(t.created).toLocaleString()}
                    {t.chunks && ` • ${t.chunks.length} chunks`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Entities from selected transcript */}
          {selectedTranscript?.entities?.length > 0 && (
            <>
              <h3 style={styles.sidebarTitle}>Detected Entities</h3>
              <div style={styles.entitiesList}>
                {selectedTranscript.entities.map((entity, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...styles.entityItem,
                      borderLeftColor: ENTITY_COLORS[entity.type],
                    }}
                  >
                    <span style={styles.entityName}>{entity.name}</span>
                    <span style={styles.entityType}>{entity.type}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Transcript Viewer */}
        <div style={styles.viewer}>
          {selectedTranscript ? (
            <>
              <div style={styles.viewerHeader}>
                <h3 style={styles.viewerTitle}>
                  {selectedTranscript.type === 'live' ? 'Live Transcript' : 'Transcript'}
                </h3>
                <span style={styles.viewerMeta}>
                  {selectedTranscript.chunks?.length || 0} segments
                </span>
              </div>
              
              <div style={styles.chunksContainer}>
                {selectedTranscript.chunks?.map((chunk, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...styles.chunk,
                      ...(playingChunk === chunk.index ? styles.chunkPlaying : {}),
                    }}
                  >
                    <div style={styles.chunkHeader}>
                      <button
                        style={{
                          ...styles.playButton,
                          ...(playingChunk === chunk.index ? styles.playButtonActive : {}),
                        }}
                        onClick={() => playingChunk === chunk.index ? stopPlayback() : playChunk(chunk)}
                        title={
                          audioLoading ? 'Loading audio...' :
                          !audioReady ? 'Audio not ready' :
                          playingChunk === chunk.index ? 'Stop' : 'Play this segment'
                        }
                        disabled={!audioData || audioLoading || !audioReady}
                      >
                        {audioLoading ? '⏳' : !audioReady ? '⏸' : playingChunk === chunk.index ? '⏹' : '▶'}
                      </button>
                      <span style={styles.chunkTimestamp}>
                        [{chunk.timestamp}]
                      </span>
                      <button
                        style={styles.parseButton}
                        onClick={() => handleParseEntities(chunk)}
                        disabled={parsingEntities.has(chunk.index)}
                        title="Extract entities from this segment"
                      >
                        {parsingEntities.has(chunk.index) ? '⏳' : '🔍'} Parse Entities
                      </button>
                    </div>
                    <div style={styles.chunkText}>
                      <HighlightedText
                        text={chunk.text}
                        entities={selectedTranscript.entities}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={styles.noTranscript}>
              <p>Select a transcript to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100%',
    gap: '20px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #3a3a4a',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#3a3a4a',
    color: '#eaeaea',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  sessionInfo: {
    flex: 1,
  },
  title: {
    margin: 0,
    fontSize: '20px',
    color: '#c9a227',
  },
  date: {
    fontSize: '12px',
    color: '#888',
  },
  content: {
    display: 'flex',
    gap: '20px',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    padding: '15px',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: '14px',
    color: '#c9a227',
    marginBottom: '10px',
    marginTop: '15px',
  },
  placeholder: {
    color: '#666',
    fontSize: '13px',
  },
  transcriptList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  transcriptItem: {
    padding: '10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid transparent',
  },
  transcriptItemActive: {
    border: '1px solid #c9a227',
    backgroundColor: '#2a2a3e',
  },
  transcriptType: {
    fontSize: '13px',
    marginBottom: '4px',
  },
  transcriptMeta: {
    fontSize: '11px',
    color: '#888',
  },
  entitiesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  entityItem: {
    padding: '8px 10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    borderLeft: '3px solid',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entityName: {
    fontSize: '13px',
  },
  entityType: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
  },
  viewer: {
    flex: 1,
    backgroundColor: '#252538',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  viewerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  viewerTitle: {
    margin: 0,
    fontSize: '16px',
    color: '#c9a227',
  },
  viewerMeta: {
    fontSize: '12px',
    color: '#888',
  },
  chunksContainer: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '10px',
  },
  chunk: {
    marginBottom: '15px',
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    border: '1px solid #3a3a4a',
  },
  chunkPlaying: {
    border: '1px solid #c9a227',
    backgroundColor: '#2a2a3e',
  },
  chunkHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
    width: '100%',
  },
  playButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#3a3a4a',
    color: '#eaeaea',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
  },
  chunkTimestamp: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#888',
  },
  parseButton: {
    marginLeft: 'auto',
    padding: '6px 12px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  chunkText: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#eaeaea',
  },
  noTranscript: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
  },
};

