import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';

export default function Images({ onPresentImage }) {
  const { activeCampaign } = useCampaign();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [images, setImages] = useState([]);
  const [sdStatus, setSdStatus] = useState({ ready: false, checking: true });
  const [llmStatus, setLlmStatus] = useState({ ready: false, checking: true });
  const [generatingChunk, setGeneratingChunk] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [hoveredImage, setHoveredImage] = useState(null);
  const [viewMode, setViewMode] = useState('session'); // 'session' or 'all'
  const [allCampaignImages, setAllCampaignImages] = useState([]);
  const [loadingAllImages, setLoadingAllImages] = useState(false);

  useEffect(() => {
    checkSdHealth();
    checkLlmHealth();
    if (activeCampaign) {
      loadSessions();
    }
  }, [activeCampaign]);

  useEffect(() => {
    if (selectedSession) {
      loadImages();
      loadTranscripts();
    } else {
      setTranscripts([]);
      setSelectedTranscript(null);
      setImages([]);
    }
  }, [selectedSession]);

  const checkSdHealth = async () => {
    setSdStatus({ ready: false, checking: true });
    const result = await window.electronAPI.sdCheckHealth();
    setSdStatus({ ready: result.success, checking: false, ...result });
  };

  const checkLlmHealth = async () => {
    setLlmStatus({ ready: false, checking: true });
    const result = await window.electronAPI.llmCheckHealth();
    setLlmStatus({ ready: result.status === 'ready', checking: false, ...result });
  };

  const loadTranscripts = async () => {
    if (!selectedSession) return;
    const result = await window.electronAPI.getSessionTranscripts(selectedSession.path);
    if (result.success && result.transcripts.length > 0) {
      setTranscripts(result.transcripts);
      setSelectedTranscript(result.transcripts[0]);
    } else {
      setTranscripts([]);
      setSelectedTranscript(null);
    }
  };

  const loadSessions = async () => {
    if (!activeCampaign) return;
    const result = await window.electronAPI.getSessions(activeCampaign.id);
    if (result.success) {
      setSessions(result.sessions);
      if (result.sessions.length > 0 && !selectedSession) {
        setSelectedSession(result.sessions[0]);
      }
    }
  };

  const loadImages = async () => {
    if (!activeCampaign || !selectedSession) return;
    const result = await window.electronAPI.getSessionImages(
      activeCampaign.id,
      selectedSession.id
    );
    if (result.success) {
      setImages(result.images);
    }
  };

  const loadAllCampaignImages = async () => {
    if (!activeCampaign) return;
    setLoadingAllImages(true);
    let allImages = [];
    for (const session of sessions) {
      const result = await window.electronAPI.getSessionImages(
        activeCampaign.id,
        session.id
      );
      if (result.success) {
        allImages = [...allImages, ...result.images.map(img => ({
          ...img,
          sessionName: session.name,
          sessionId: session.id
        }))];
      }
    }
    // Sort newest first
    allImages.sort((a, b) => new Date(b.created) - new Date(a.created));
    setAllCampaignImages(allImages);
    setLoadingAllImages(false);
  };

  const handleGenerateFromChunk = async (chunk) => {
    if (!selectedSession || !chunk.text) return;

    const chunkIndex = chunk.index;
    setGeneratingChunk(chunkIndex);
    try {
      // Use LLM to generate a good image prompt from the chunk text
      let imagePrompt = chunk.text;
      if (llmStatus.ready) {
        const promptResult = await window.electronAPI.generateScenePrompt(chunk.text);
        if (promptResult.success && promptResult.prompt) {
          imagePrompt = promptResult.prompt;
        }
      }

      // Generate the image
      const result = await window.electronAPI.sdGenerateImage(imagePrompt);

      if (result.success && result.image_base64) {
        // Save the image with chunk metadata
        const saveResult = await window.electronAPI.saveGeneratedImage(
          activeCampaign.id,
          selectedSession.id,
          result.image_base64,
          {
            prompt: imagePrompt,
            seed: result.seed,
            chunkIndex: chunkIndex,
            chunkText: chunk.text,
            timestamp: chunk.timestamp
          }
        );

        if (saveResult.success) {
          await loadImages();
        } else {
          alert(`Failed to save image: ${saveResult.error}`);
        }
      } else {
        alert(`Generation failed: ${result.error || 'No image returned'}`);
      }
    } catch (err) {
      console.error('Generate from chunk error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingChunk(null);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!activeCampaign || !selectedSession) return;

    try {
      const result = await window.electronAPI.deleteSessionImage(
        activeCampaign.id,
        selectedSession.id,
        imageId
      );
      if (result.success) {
        await loadImages();
      } else {
        alert(`Failed to delete: ${result.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Get images for a specific chunk (sorted newest first)
  const getImagesForChunk = (chunkIndex) => {
    return images
      .filter((img) => Number(img.chunkIndex) === Number(chunkIndex))
      .sort((a, b) => new Date(b.created) - new Date(a.created));
  };

  if (!activeCampaign) {
    return (
      <div style={styles.empty}>
        <p>Select a campaign first to manage images.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <button
          onClick={() => {
            setViewMode('all');
            setSelectedSession(null);
            loadAllCampaignImages();
          }}
          style={{
            ...styles.allImagesButton,
            backgroundColor: viewMode === 'all' ? '#3a3a4a' : 'transparent',
          }}
        >
          All Campaign Images
        </button>

        <h3 style={styles.sidebarTitle}>Sessions</h3>
        {sessions.length === 0 ? (
          <p style={styles.emptyList}>No sessions yet</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                setViewMode('session');
                setSelectedSession(session);
              }}
              style={{
                ...styles.sessionButton,
                backgroundColor:
                  viewMode === 'session' && selectedSession?.id === session.id ? '#3a3a4a' : 'transparent',
              }}
            >
              {session.name}
            </button>
          ))
        )}
      </div>

      <div style={styles.content}>
        {/* Status Bar */}
        <div style={styles.statusBar}>
          <span style={styles.statusLabel}>SD Backend:</span>
          {sdStatus.checking ? (
            <span style={styles.statusChecking}>Checking...</span>
          ) : sdStatus.ready ? (
            <span style={styles.statusReady}>Ready</span>
          ) : (
            <span style={styles.statusOffline}>Offline</span>
          )}
          <button onClick={checkSdHealth} style={styles.refreshButton}>↻</button>

          <span style={{ ...styles.statusLabel, marginLeft: '20px' }}>LLM:</span>
          {llmStatus.checking ? (
            <span style={styles.statusChecking}>Checking...</span>
          ) : llmStatus.ready ? (
            <span style={styles.statusReady}>Ready</span>
          ) : (
            <span style={styles.statusOffline}>Offline</span>
          )}
          <button onClick={checkLlmHealth} style={styles.refreshButton}>↻</button>

          {/* Transcript selector */}
          {transcripts.length > 1 && (
            <select
              value={selectedTranscript?.filename || ''}
              onChange={(e) => {
                const t = transcripts.find((tr) => tr.filename === e.target.value);
                setSelectedTranscript(t);
              }}
              style={styles.transcriptSelect}
            >
              {transcripts.map((t) => (
                <option key={t.filename} value={t.filename}>
                  {t.type === 'live' ? 'Live' : 'Full'} - {new Date(t.created).toLocaleString()}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Chunks with images */}
        <div style={styles.chunksContainer}>
          {viewMode === 'all' ? (
            <div style={styles.allImagesGrid}>
              {loadingAllImages ? (
                <div style={styles.loadingContainer}>
                  <div style={styles.spinner} />
                  <p style={styles.loadingText}>Loading images...</p>
                </div>
              ) : allCampaignImages.length === 0 ? (
                <p style={styles.emptyMessage}>No images in this campaign yet</p>
              ) : (
                allCampaignImages.map((img) => (
                  <div
                    key={img.id}
                    style={styles.allImagesCard}
                    onMouseEnter={() => setHoveredImage(img.id)}
                    onMouseLeave={() => setHoveredImage(null)}
                  >
                    <img
                      src={img.url}
                      alt={img.prompt}
                      style={styles.allImagesImage}
                      onClick={() => onPresentImage && onPresentImage(img.url)}
                    />
                    {hoveredImage === img.id && (
                      <button
                        style={styles.deleteButton}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await window.electronAPI.deleteSessionImage(
                            activeCampaign.id,
                            img.sessionId,
                            img.id
                          );
                          loadAllCampaignImages();
                        }}
                        title="Delete image"
                      >
                        ×
                      </button>
                    )}
                    <div style={styles.allImagesCardInfo}>
                      <span style={styles.allImagesSession}>{img.sessionName}</span>
                      <span style={styles.allImagesDate}>
                        {new Date(img.created).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : !selectedSession ? (
            <p style={styles.emptyMessage}>Select a session to view and generate images</p>
          ) : !selectedTranscript ? (
            <p style={styles.emptyMessage}>No transcripts available for this session</p>
          ) : !selectedTranscript.chunks?.length ? (
            <p style={styles.emptyMessage}>No chunks in transcript</p>
          ) : (
            selectedTranscript.chunks.map((chunk, idx) => {
              const chunkIndex = chunk.index ?? idx;
              const chunkText = chunk.text || '';
              const chunkImages = getImagesForChunk(chunkIndex);
              const isGenerating = generatingChunk === chunkIndex;

              return (
                <div key={chunkIndex} style={styles.chunkRow}>
                  <div style={styles.chunkTextSection}>
                    <div style={styles.chunkTimestamp}>
                      {chunk.timestamp || `${Math.floor(chunkIndex * 12 / 60)}:${String((chunkIndex * 12) % 60).padStart(2, '0')}`}
                    </div>
                    <div style={styles.chunkText}>{chunkText}</div>
                    <button
                      onClick={() => handleGenerateFromChunk({ ...chunk, index: chunkIndex, text: chunkText })}
                      disabled={!sdStatus.ready || generatingChunk !== null || !chunkText}
                      style={{
                        ...styles.genButton,
                        opacity: (!sdStatus.ready || generatingChunk !== null || !chunkText) ? 0.5 : 1,
                      }}
                    >
                      {isGenerating ? 'Generating...' : 'Gen'}
                    </button>
                  </div>
                  <div style={styles.chunkImagesSection}>
                    {isGenerating && (
                      <div style={styles.imageSlot}>
                        <div style={styles.imageLoading}>
                          <div style={styles.spinner} />
                        </div>
                      </div>
                    )}
                    {chunkImages.map((img) => (
                      <div
                        key={img.id}
                        style={styles.imageSlot}
                        onMouseEnter={() => setHoveredImage(img.id)}
                        onMouseLeave={() => setHoveredImage(null)}
                      >
                        <img
                          src={img.url}
                          alt={img.prompt}
                          style={styles.chunkImage}
                          onClick={() => onPresentImage && onPresentImage(img.url)}
                        />
                        {hoveredImage === img.id && (
                          <button
                            style={styles.deleteButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(img.id);
                            }}
                            title="Delete image"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {chunkImages.length === 0 && !isGenerating && (
                      <div style={styles.noImages}>No images</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: '20px',
    height: 'calc(100vh - 120px)',
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    padding: '40px',
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    padding: '15px',
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: '14px',
    color: '#c9a227',
    marginBottom: '15px',
    marginTop: '15px',
  },
  allImagesButton: {
    width: '100%',
    padding: '12px 10px',
    border: '1px solid #c9a227',
    borderRadius: '4px',
    color: '#c9a227',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textAlign: 'center',
    marginBottom: '10px',
  },
  sessionButton: {
    width: '100%',
    padding: '10px',
    border: 'none',
    borderRadius: '4px',
    color: '#eaeaea',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '5px',
  },
  emptyList: {
    color: '#666',
    fontSize: '13px',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    minHeight: 0,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 15px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  statusLabel: {
    fontSize: '13px',
    color: '#888',
  },
  statusChecking: {
    fontSize: '13px',
    color: '#888',
  },
  statusReady: {
    fontSize: '13px',
    color: '#4ade80',
  },
  statusOffline: {
    fontSize: '13px',
    color: '#ef4444',
  },
  refreshButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#888',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  },
  transcriptSelect: {
    marginLeft: 'auto',
    padding: '6px 10px',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    border: '1px solid #3a3a4a',
    borderRadius: '4px',
    fontSize: '12px',
  },
  chunksContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingRight: '5px',
  },
  emptyMessage: {
    color: '#666',
    textAlign: 'center',
    padding: '40px',
  },
  chunkRow: {
    display: 'flex',
    gap: '15px',
    padding: '15px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    alignItems: 'flex-start',
  },
  chunkTextSection: {
    width: '300px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  chunkTimestamp: {
    fontSize: '12px',
    color: '#c9a227',
    fontFamily: 'monospace',
  },
  chunkText: {
    fontSize: '14px',
    color: '#ccc',
    lineHeight: '1.5',
  },
  genButton: {
    alignSelf: 'flex-start',
    padding: '8px 16px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  chunkImagesSection: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'flex-start',
    alignContent: 'flex-start',
    minHeight: '120px',
  },
  imageSlot: {
    position: 'relative',
    width: '120px',
    height: '120px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  chunkImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    cursor: 'pointer',
  },
  imageLoading: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid #3a3a4a',
    borderTop: '3px solid #c9a227',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  deleteButton: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '24px',
    height: '24px',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  noImages: {
    color: '#555',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '120px',
    height: '120px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
  },
  allImagesGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px',
    alignContent: 'flex-start',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    width: '100%',
  },
  loadingText: {
    color: '#888',
    fontSize: '14px',
    marginTop: '15px',
  },
  allImagesCard: {
    position: 'relative',
    width: '180px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  allImagesImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
    cursor: 'pointer',
    display: 'block',
  },
  allImagesCardInfo: {
    padding: '8px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allImagesSession: {
    fontSize: '12px',
    color: '#c9a227',
  },
  allImagesDate: {
    fontSize: '11px',
    color: '#666',
  },
};
