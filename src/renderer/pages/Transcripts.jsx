import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';

export default function Transcripts() {
  const { activeCampaign } = useCampaign();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeCampaign) {
      loadSessions();
    }
  }, [activeCampaign]);

  const loadSessions = async () => {
    if (!activeCampaign) return;
    const result = await window.electronAPI.getSessions(activeCampaign.id);
    if (result.success) {
      setSessions(result.sessions.filter((s) => s.hasTranscript));
    }
  };

  const loadTranscript = async (session) => {
    setSelectedSession(session);
    setLoading(true);
    try {
      const result = await window.electronAPI.getTranscript(session.path);
      if (result.success) {
        setTranscript(result.transcript);
      } else {
        setTranscript(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (start) => {
    const totalSeconds = Math.floor(start / 100);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getFullText = () => {
    if (!transcript?.transcription) return '';
    return transcript.transcription.map((seg) => seg.text).join(' ');
  };

  if (!activeCampaign) {
    return (
      <div style={styles.empty}>
        <p>Select a campaign first to view transcripts.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h3 style={styles.sidebarTitle}>Sessions</h3>
        {sessions.length === 0 ? (
          <p style={styles.emptyList}>No transcripts yet</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => loadTranscript(session)}
              style={{
                ...styles.sessionButton,
                backgroundColor:
                  selectedSession?.id === session.id
                    ? '#3a3a4a'
                    : 'transparent',
              }}
            >
              {session.name}
            </button>
          ))
        )}
      </div>

      <div style={styles.content}>
        {!selectedSession ? (
          <p style={styles.placeholder}>Select a session to view its transcript</p>
        ) : loading ? (
          <p style={styles.placeholder}>Loading...</p>
        ) : !transcript ? (
          <p style={styles.placeholder}>No transcript available</p>
        ) : (
          <div style={styles.transcript}>
            <div style={styles.fullText}>
              <h3 style={styles.sectionTitle}>Full Text</h3>
              <p style={styles.text}>{getFullText()}</p>
            </div>

            {transcript.transcription && (
              <div style={styles.segments}>
                <h3 style={styles.sectionTitle}>Timestamped Segments</h3>
                {transcript.transcription.map((segment, idx) => (
                  <div key={idx} style={styles.segment}>
                    <span style={styles.timestamp}>
                      {formatTimestamp(segment.offsets?.from || 0)}
                    </span>
                    <span style={styles.segmentText}>{segment.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
    width: '250px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    padding: '15px',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: '14px',
    color: '#c9a227',
    marginBottom: '15px',
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
    backgroundColor: '#252538',
    borderRadius: '8px',
    padding: '20px',
    overflowY: 'auto',
  },
  placeholder: {
    color: '#666',
    fontSize: '14px',
  },
  transcript: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  fullText: {},
  sectionTitle: {
    fontSize: '14px',
    color: '#c9a227',
    marginBottom: '10px',
  },
  text: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#eaeaea',
  },
  segments: {},
  segment: {
    display: 'flex',
    gap: '15px',
    padding: '8px 0',
    borderBottom: '1px solid #3a3a4a',
  },
  timestamp: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#888',
    flexShrink: 0,
  },
  segmentText: {
    fontSize: '14px',
    color: '#eaeaea',
  },
};
