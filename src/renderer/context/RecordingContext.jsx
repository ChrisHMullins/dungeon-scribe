import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import useAudioRecorder from '../hooks/useAudioRecorder';

const RecordingContext = createContext(null);

export function RecordingProvider({ children }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [liveMode, setLiveMode] = useState(true);
  const [autoDetectEntities, setAutoDetectEntities] = useState(false);
  const [autoGenerateImages, setAutoGenerateImages] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [detectedEntities, setDetectedEntities] = useState([]);
  const [processingChunk, setProcessingChunk] = useState(false);
  const [showLiveTranscript, setShowLiveTranscript] = useState(false);
  const [chunkImages, setChunkImages] = useState({}); // { chunkIndex: { image: base64, loading: bool } }

  const currentSessionRef = useRef(null);
  const activeCampaignRef = useRef(null);
  const llmStatusRef = useRef(null);
  const autoDetectRef = useRef(false);
  const autoGenerateImagesRef = useRef(true);
  const sdStatusRef = useRef(null);

  // Keep refs in sync
  React.useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  React.useEffect(() => {
    autoDetectRef.current = autoDetectEntities;
  }, [autoDetectEntities]);

  React.useEffect(() => {
    autoGenerateImagesRef.current = autoGenerateImages;
  }, [autoGenerateImages]);

  // Generate image for a chunk (runs async in background)
  const generateChunkImage = useCallback(async (chunkIndex, text) => {
    if (!sdStatusRef.current?.success) return;

    // Mark as loading
    setChunkImages((prev) => ({
      ...prev,
      [chunkIndex]: { loading: true, image: null }
    }));

    try {
      // Generate prompt from text using LLM (if available)
      let imagePrompt = text;
      if (llmStatusRef.current?.status === 'ready') {
        const promptResult = await window.electronAPI.generateScenePrompt(text);
        if (promptResult.success && promptResult.prompt) {
          imagePrompt = promptResult.prompt;
        }
      }

      // Generate image
      const result = await window.electronAPI.sdGenerateImage(imagePrompt);

      if (result.success && result.image_base64) {
        setChunkImages((prev) => ({
          ...prev,
          [chunkIndex]: { loading: false, image: result.image_base64, prompt: imagePrompt }
        }));

        // Optionally save the image to the session
        const session = currentSessionRef.current;
        const campaign = activeCampaignRef.current;
        if (session && campaign) {
          await window.electronAPI.saveGeneratedImage(
            campaign.id,
            session.id,
            result.image_base64,
            { prompt: imagePrompt, seed: result.seed, chunkIndex }
          );
        }
      } else {
        setChunkImages((prev) => ({
          ...prev,
          [chunkIndex]: { loading: false, image: null, error: result.error }
        }));
      }
    } catch (err) {
      console.error('Chunk image generation failed:', err);
      setChunkImages((prev) => ({
        ...prev,
        [chunkIndex]: { loading: false, image: null, error: err.message }
      }));
    }
  }, []);

  // Handle incoming audio chunks
  const handleChunk = useCallback(async (buffer, chunkIndex) => {
    const session = currentSessionRef.current;
    if (!session) return;

    setProcessingChunk(true);
    try {
      const result = await window.electronAPI.transcribeChunk(
        buffer,
        session.path,
        chunkIndex
      );

      if (result.success && result.text && result.text.trim()) {
        const newText = result.text.trim();
        setLiveTranscript((prev) => [
          ...prev,
          { index: chunkIndex, text: newText, time: new Date() }
        ]);

        // Generate image for this chunk (async, don't await)
        if (autoGenerateImagesRef.current && sdStatusRef.current?.success) {
          generateChunkImage(chunkIndex, newText);
        }

        // Extract entities if enabled
        if (autoDetectRef.current && llmStatusRef.current?.status === 'ready') {
          const entityResult = await window.electronAPI.extractEntities(newText);
          if (entityResult.success && entityResult.entities.length > 0) {
            const processResult = await window.electronAPI.processEntities(
              activeCampaignRef.current?.id,
              entityResult.entities
            );

            if (processResult.success) {
              setDetectedEntities((prev) => {
                const existingNames = new Set(prev.map(e => e.name.toLowerCase()));
                const newEntities = entityResult.entities.filter(
                  e => !existingNames.has(e.name.toLowerCase())
                );
                return [...prev, ...newEntities];
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Chunk transcription failed:', err);
    } finally {
      setProcessingChunk(false);
    }
  }, [generateChunkImage]);

  const {
    duration,
    chunkCount,
    micLevel,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    pauseRecording: pauseAudioRecording,
    resumeRecording: resumeAudioRecording,
    flushChunk,
  } = useAudioRecorder({ onChunk: liveMode ? handleChunk : undefined });

  const startRecording = useCallback(async (campaign, session, deviceId) => {
    if (!campaign || !session) return;

    activeCampaignRef.current = campaign;
    setCurrentSession(session);
    setLiveTranscript([]);
    setDetectedEntities([]);
    setChunkImages({});
    setShowLiveTranscript(false);

    // Check LLM status
    const llmStatus = await window.electronAPI.llmCheckHealth();
    llmStatusRef.current = llmStatus;

    // Check SD status for auto image generation
    const sdStatus = await window.electronAPI.sdCheckHealth();
    sdStatusRef.current = sdStatus;

    await startAudioRecording(deviceId, liveMode);
    setIsRecording(true);
    setIsPaused(false);
  }, [liveMode, startAudioRecording]);

  const stopRecording = useCallback(async () => {
    const audioBlob = await stopAudioRecording();
    const session = currentSessionRef.current;
    setIsRecording(false);
    setIsPaused(false);
    
    if (audioBlob && session) {
      // Save audio
      const buffer = await audioBlob.arrayBuffer();
      await window.electronAPI.updateSessionAudio(session.path, buffer);
      
      // Save transcript
      if (liveTranscript.length > 0) {
        const transcriptData = {
          type: 'live',
          created: new Date().toISOString(),
          duration: duration,
          chunks: liveTranscript.map((item) => ({
            index: item.index,
            text: item.text,
            timestamp: `${String(Math.floor(item.index * 12 / 60)).padStart(2, '0')}:${String((item.index * 12) % 60).padStart(2, '0')}`,
          })),
          entities: detectedEntities,
        };
        
        await window.electronAPI.saveLiveTranscript(
          session.path,
          transcriptData
        );
      }
    }
    
    // Clear transcript/entity state but keep session selected for next recording
    setLiveTranscript([]);
    setDetectedEntities([]);
    setChunkImages({});
    setShowLiveTranscript(false);
    // Keep currentSession so user can record again
  }, [stopAudioRecording, liveTranscript, detectedEntities, duration]);

  const pause = useCallback(() => {
    pauseAudioRecording();
    setIsPaused(true);
  }, [pauseAudioRecording]);

  const resume = useCallback(() => {
    resumeAudioRecording();
    setIsPaused(false);
  }, [resumeAudioRecording]);

  const newTake = useCallback(async () => {
    await flushChunk();
    setLiveTranscript([]);
    setDetectedEntities([]);
    setChunkImages({});
  }, [flushChunk]);

  const value = {
    isRecording,
    isPaused,
    currentSession,
    liveMode,
    autoDetectEntities,
    autoGenerateImages,
    liveTranscript,
    detectedEntities,
    chunkImages,
    processingChunk,
    showLiveTranscript,
    duration,
    chunkCount,
    micLevel,
    setLiveMode,
    setAutoDetectEntities,
    setAutoGenerateImages,
    setShowLiveTranscript,
    startRecording,
    stopRecording,
    pause,
    resume,
    newTake,
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
}

