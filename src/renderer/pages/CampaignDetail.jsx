import React, { useState, useEffect, useRef } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useRecording } from '../context/RecordingContext';
import Sessions from './Sessions';
import Profiles from './Profiles';
import Images from './Images';
import SessionDetail from './SessionDetail';

export default function CampaignDetail({ campaign, onBack, onSelectSession, selectedSession, onPresentImage }) {
  const { activeCampaign } = useCampaign();
  const recording = useRecording();
  const [selectedTab, setSelectedTab] = useState('sessions');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const liveTranscriptEndRef = useRef(null);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (liveTranscriptEndRef.current && recording.showLiveTranscript) {
      liveTranscriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [recording.liveTranscript, recording.showLiveTranscript]);

  useEffect(() => {
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
        setDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error('Failed to get audio devices:', err);
      }
    }
    getDevices();
  }, []);

  const handleStartRecording = async () => {
    if (!activeCampaign) return;
    
    // Create new session if none selected
    let session = selectedSession;
    if (!session) {
      const emptyBuffer = new ArrayBuffer(0);
      const result = await window.electronAPI.saveAudioFile(activeCampaign.id, emptyBuffer);
      if (result.success) {
        session = result.session;
        onSelectSession(session);
      } else {
        alert(`Failed to create session: ${result.error}`);
        return;
      }
    }
    
    await recording.startRecording(activeCampaign, session, selectedDevice);
  };

  const handleStopRecording = async () => {
    await recording.stopRecording();
  };

  const handleViewLiveTranscript = () => {
    recording.setShowLiveTranscript(true);
    setSelectedTab('sessions');
  };

  return (
    <div style={styles.container}>
      {/* Record Button Header - only show when session selected */}
      {selectedSession && (
        <div style={styles.recordHeader}>
          <div style={styles.recordHeaderLeft}>
            {recording.isRecording && (
              <div style={styles.recordingIndicator}>
                <span style={styles.recordingDot}>●</span>
                <span>Recording...</span>
                {!recording.showLiveTranscript && (
                  <button
                    onClick={handleViewLiveTranscript}
                    style={styles.liveTranscriptLink}
                  >
                    View Live Transcript →
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={styles.recordHeaderRight}>
            {!recording.isRecording ? (
              <button onClick={handleStartRecording} style={styles.recordButton}>
                ⏺ Record New Session
              </button>
            ) : (
              <button onClick={handleStopRecording} style={styles.stopButton}>
                ⏹ Stop Recording
              </button>
            )}
            <div style={styles.recordOptions}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={recording.liveMode}
                  onChange={(e) => recording.setLiveMode(e.target.checked)}
                  disabled={recording.isRecording}
                />
                Live Transcription
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={recording.autoDetectEntities}
                  onChange={(e) => recording.setAutoDetectEntities(e.target.checked)}
                  disabled={recording.isRecording || !recording.liveMode}
                />
                Auto Detect Entities
              </label>
            </div>
          </div>
        </div>
      )}

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(selectedTab === 'sessions' ? styles.tabActive : {}),
          }}
          onClick={() => {
            setSelectedTab('sessions');
            // Clear selected session to show sessions list
            if (selectedSession) {
              onSelectSession(null);
            }
          }}
        >
          📜 Sessions
        </button>
        <button
          style={{
            ...styles.tab,
            ...(selectedTab === 'profiles' ? styles.tabActive : {}),
          }}
          onClick={() => setSelectedTab('profiles')}
        >
          👤 Profiles
        </button>
        <button
          style={{
            ...styles.tab,
            ...(selectedTab === 'images' ? styles.tabActive : {}),
          }}
          onClick={() => setSelectedTab('images')}
        >
          🖼️ Images
        </button>
      </div>

      <div style={styles.content}>
        {selectedTab === 'sessions' && (
          selectedSession ? (
            recording.showLiveTranscript && recording.isRecording ? (
              <div style={styles.liveTranscriptView}>
                <div style={styles.liveTranscriptHeader}>
                  <h3 style={styles.liveTranscriptTitle}>Live Transcript</h3>
                  <label style={styles.checkboxLabelSmall}>
                    <input
                      type="checkbox"
                      checked={recording.autoGenerateImages}
                      onChange={(e) => recording.setAutoGenerateImages(e.target.checked)}
                    />
                    Auto-generate images
                  </label>
                </div>
                <div style={styles.liveTranscriptContent}>
                  {recording.liveTranscript.length === 0 ? (
                    <p style={styles.placeholder}>
                      {recording.processingChunk ? 'Processing first chunk...' : 'Waiting for speech...'}
                    </p>
                  ) : (
                    <>
                      {recording.liveTranscript.map((item, idx) => {
                        const chunkImage = recording.chunkImages[item.index];
                        return (
                          <div key={idx} style={styles.liveChunkRow}>
                            <div style={styles.liveChunkText}>
                              <span style={styles.liveChunkTimestamp}>
                                [{String(Math.floor(item.index * 12 / 60)).padStart(2, '0')}:
                                {String((item.index * 12) % 60).padStart(2, '0')}]
                              </span>
                              {item.text}
                            </div>
                            <div style={styles.liveChunkImage}>
                              {chunkImage?.loading ? (
                                <div style={styles.imageLoading}>
                                  <div style={styles.spinner} />
                                  <span>Generating...</span>
                                </div>
                              ) : chunkImage?.image ? (
                                <img
                                  src={`data:image/png;base64,${chunkImage.image}`}
                                  alt="Generated scene"
                                  style={styles.chunkThumbnail}
                                  onClick={() => onPresentImage && onPresentImage(`data:image/png;base64,${chunkImage.image}`)}
                                />
                              ) : (
                                <div style={styles.noImage}>
                                  {chunkImage?.error ? 'Error' : '—'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={liveTranscriptEndRef} />
                    </>
                  )}
                </div>
              </div>
            ) : (
              <SessionDetail
                session={selectedSession}
                onBack={() => onSelectSession(null)}
              />
            )
          ) : (
            <Sessions onSelectSession={onSelectSession} />
          )
        )}
        {selectedTab === 'profiles' && (
          <div>
            {recording.isRecording && (
              <div style={styles.recordingNote}>
                <span style={styles.recordingDot}>●</span> Recording in progress... You can view profiles while recording.
              </div>
            )}
            <Profiles />
          </div>
        )}
        {selectedTab === 'images' && (
          <div>
            {recording.isRecording && (
              <div style={styles.recordingNote}>
                <span style={styles.recordingDot}>●</span> Recording in progress... You can view images while recording.
              </div>
            )}
            <Images onPresentImage={onPresentImage} />
          </div>
        )}
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
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '20px',
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
  title: {
    fontSize: '28px',
    color: '#c9a227',
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '2px solid #3a3a4a',
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#888',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
  },
  tabActive: {
    color: '#c9a227',
    borderBottomColor: '#c9a227',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  recordHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  recordHeaderLeft: {
    flex: 1,
  },
  recordHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#e74c3c',
    fontSize: '14px',
  },
  recordingDot: {
    color: '#e74c3c',
    fontSize: '16px',
    animation: 'pulse 1s infinite',
  },
  liveTranscriptLink: {
    padding: '6px 12px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    marginLeft: '15px',
  },
  recordButton: {
    padding: '10px 20px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  stopButton: {
    padding: '10px 20px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  recordOptions: {
    display: 'flex',
    gap: '20px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#aaa',
    cursor: 'pointer',
  },
  liveTranscriptView: {
    backgroundColor: '#252538',
    borderRadius: '8px',
    padding: '20px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  liveTranscriptHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexShrink: 0,
  },
  liveTranscriptTitle: {
    fontSize: '18px',
    color: '#c9a227',
    margin: 0,
  },
  checkboxLabelSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#888',
    cursor: 'pointer',
  },
  liveTranscriptContent: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '10px',
  },
  liveChunkRow: {
    display: 'flex',
    gap: '15px',
    marginBottom: '12px',
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    alignItems: 'flex-start',
  },
  liveChunkText: {
    flex: 1,
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#eaeaea',
  },
  liveChunkTimestamp: {
    fontFamily: 'monospace',
    color: '#c9a227',
    marginRight: '8px',
  },
  liveChunkImage: {
    width: '240px',
    height: '240px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#252538',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  imageLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    color: '#888',
    fontSize: '11px',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid #3a3a4a',
    borderTop: '3px solid #c9a227',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  chunkThumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    cursor: 'pointer',
  },
  noImage: {
    color: '#555',
    fontSize: '12px',
  },
  placeholder: {
    color: '#666',
    fontSize: '14px',
  },
  recordingNote: {
    padding: '12px',
    backgroundColor: '#2a2a3e',
    borderRadius: '6px',
    marginBottom: '20px',
    color: '#aaa',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

