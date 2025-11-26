import { useState, useRef, useCallback, useEffect } from 'react';

const CHUNK_INTERVAL_MS = 12000; // 12 seconds per chunk

export default function useAudioRecorder({ onChunk } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const allChunksRef = useRef([]); // Keep all chunks for full session
  const headerChunkRef = useRef(null); // Store WebM header from first data
  const timerRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const levelTimerRef = useRef(null);
  const chunkCountRef = useRef(0);
  const onChunkRef = useRef(onChunk);

  // Keep refs in sync
  useEffect(() => {
    onChunkRef.current = onChunk;
  }, [onChunk]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const processChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    
    const currentChunkIndex = chunkCountRef.current;
    chunkCountRef.current += 1;
    
    // For the first chunk, save the header (first blob contains WebM init segment)
    if (currentChunkIndex === 0 && chunksRef.current.length > 0) {
      headerChunkRef.current = chunksRef.current[0];
    }
    
    // Create a complete WebM file by including header + current chunk data
    let blobParts;
    if (currentChunkIndex === 0) {
      blobParts = chunksRef.current;
    } else {
      // Prepend header to make a valid WebM file
      blobParts = headerChunkRef.current 
        ? [headerChunkRef.current, ...chunksRef.current]
        : chunksRef.current;
    }
    
    const chunkBlob = new Blob(blobParts, { type: 'audio/webm' });
    allChunksRef.current.push(...chunksRef.current);
    chunksRef.current = [];
    
    setChunkCount(chunkCountRef.current);
    
    if (onChunkRef.current) {
      const buffer = await chunkBlob.arrayBuffer();
      onChunkRef.current(buffer, currentChunkIndex);
    }
  }, []);

  const startRecording = useCallback(async (deviceId, liveMode = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up audio level monitoring
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Monitor mic level
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      levelTimerRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(Math.min(100, Math.round(avg * 1.5)));
      }, 50);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      chunksRef.current = [];
      allChunksRef.current = [];
      chunkCountRef.current = 0;
      headerChunkRef.current = null;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setChunkCount(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Chunk processing timer (for live mode)
      if (liveMode && onChunk) {
        chunkTimerRef.current = setInterval(() => {
          processChunk();
        }, CHUNK_INTERVAL_MS);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [onChunk, processChunk]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        // Combine remaining chunks with all chunks
        const allData = [...allChunksRef.current, ...chunksRef.current];
        const blob = new Blob(allData, { type: 'audio/webm' });
        chunksRef.current = [];
        allChunksRef.current = [];
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        
        resolve(blob);
      };

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
      if (levelTimerRef.current) {
        clearInterval(levelTimerRef.current);
        levelTimerRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setMicLevel(0);

      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
    });
  }, []);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      // Resume chunk timer if we have onChunk
      if (onChunk) {
        chunkTimerRef.current = setInterval(() => {
          processChunk();
        }, CHUNK_INTERVAL_MS);
      }
    }
  }, [onChunk, processChunk]);

  // Force process current chunk (for "new take")
  const flushChunk = useCallback(async () => {
    await processChunk();
  }, [processChunk]);

  return {
    isRecording,
    isPaused,
    duration,
    chunkCount,
    micLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    flushChunk,
  };
}
