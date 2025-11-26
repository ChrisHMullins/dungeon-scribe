import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';

export default function Sessions({ onSelectSession }) {
  const { activeCampaign } = useCampaign();
  const [sessions, setSessions] = useState([]);
  const [transcribing, setTranscribing] = useState(null);

  const loadSessions = async () => {
    if (!activeCampaign) return;
    const result = await window.electronAPI.getSessions(activeCampaign.id);
    if (result.success) {
      setSessions(result.sessions);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [activeCampaign]);

  const handleCreateSession = async () => {
    if (!activeCampaign) return;
    
    // Create new session without recording
    const emptyBuffer = new ArrayBuffer(0);
    const result = await window.electronAPI.saveAudioFile(activeCampaign.id, emptyBuffer);
    if (result.success) {
      await loadSessions();
      // Auto-select the new session
      if (onSelectSession) {
        onSelectSession(result.session);
      }
    }
  };

  const handleTranscribe = async (session) => {
    setTranscribing(session.id);
    try {
      const result = await window.electronAPI.transcribeAudio(session.path);
      if (result.success) {
        await loadSessions();
      } else {
        alert(`Transcription failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setTranscribing(null);
    }
  };

  const handleDelete = async (session) => {
    if (!confirm(`Delete session "${session.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      const result = await window.electronAPI.deleteSession(session.path);
      if (result.success) {
        await loadSessions();
      } else {
        alert(`Delete failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  if (!activeCampaign) {
    return (
      <div style={styles.empty}>
        <p>Select a campaign first to manage sessions.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.sessionsHeader}>
        <button onClick={handleCreateSession} style={styles.newSessionButton}>
          + New Session
        </button>
      </div>

      <div style={styles.sessionsList}>
        {sessions.length === 0 ? (
          <p style={styles.placeholder}>No sessions yet. Create a new session to get started!</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              style={styles.sessionCard}
              onClick={() => onSelectSession?.(session)}
            >
              <div style={styles.sessionInfo}>
                <div style={styles.sessionName}>{session.name}</div>
                <div style={styles.sessionDate}>
                  {formatDate(session.created)}
                  {session.hasTranscript && (
                    <span style={styles.transcriptBadge}>✓ Transcribed</span>
                  )}
                  {session.hasLiveTranscript && (
                    <span style={styles.liveBadge}>🎙️ Live</span>
                  )}
                </div>
              </div>
              <div style={styles.sessionActions}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSession?.(session);
                  }}
                  style={styles.viewButton}
                  title="View session details"
                >
                  👁
                </button>
                {!session.hasTranscript && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTranscribe(session);
                    }}
                    disabled={transcribing === session.id}
                    style={styles.transcribeButton}
                  >
                    {transcribing === session.id ? 'Transcribing...' : 'Transcribe'}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(session);
                  }}
                  style={styles.deleteButton}
                  title="Delete session"
                >
                  🗑
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    padding: '40px',
  },
  sessionsHeader: {
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'flex-start',
  },
  newSessionButton: {
    padding: '10px 20px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  sessionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
    overflowY: 'auto',
  },
  placeholder: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px',
  },
  sessionCard: {
    backgroundColor: '#1a1a2e',
    padding: '15px',
    borderRadius: '6px',
    border: '1px solid #3a3a4a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: '16px',
    marginBottom: '5px',
    color: '#c9a227',
  },
  sessionDate: {
    fontSize: '12px',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  transcriptBadge: {
    color: '#4ade80',
    fontSize: '11px',
  },
  liveBadge: {
    color: '#60a5fa',
    fontSize: '11px',
  },
  sessionActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  viewButton: {
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: '#60a5fa',
    border: '1px solid #60a5fa',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  transcribeButton: {
    padding: '8px 16px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: '#e74c3c',
    border: '1px solid #e74c3c',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
};
