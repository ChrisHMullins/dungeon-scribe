import React, { useState } from 'react';
import { CampaignProvider } from './context/CampaignContext';
import { RecordingProvider } from './context/RecordingContext';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Transcripts from './pages/Transcripts';
import PresentMode from './components/PresentMode';

const navItems = [
  { id: 'campaigns', label: 'Campaigns', icon: '🏰' },
  { id: 'transcripts', label: 'Transcripts', icon: '📝' },
];

function PageContent({ activePage, onPresentImage, selectedCampaign, onSelectCampaign, selectedSession, onSelectSession }) {
  switch (activePage) {
    case 'campaigns':
      if (selectedCampaign) {
        return (
          <CampaignDetail
            campaign={selectedCampaign}
            onBack={() => onSelectCampaign(null)}
            onSelectSession={onSelectSession}
            selectedSession={selectedSession}
            onPresentImage={onPresentImage}
          />
        );
      }
      return <Campaigns onSelectCampaign={onSelectCampaign} />;
    case 'transcripts':
      return <Transcripts />;
    default:
      return <p style={{ color: '#666' }}>Content coming soon...</p>;
  }
}

function AppContent() {
  const [activePage, setActivePage] = useState('campaigns');
  const [presentImage, setPresentImage] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    setSelectedCampaign(null);
    setSelectedSession(null);
  };

  const getPageTitle = () => {
    if (selectedCampaign) {
      return selectedCampaign.name;
    }
    return navItems.find((n) => n.id === activePage)?.label || 'Campaigns';
  };

  return (
    <>
      <div style={styles.container}>
        <nav style={styles.sidebar}>
          <h1 
            style={{...styles.logo, ...styles.logoClickable}}
            onClick={() => {
              setActivePage('campaigns');
              setSelectedCampaign(null);
              setSelectedSession(null);
            }}
          >
            Dungeon Scribe
          </h1>
          <div style={styles.navDivider} />
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              style={{
                ...styles.navButton,
                backgroundColor: activePage === item.id ? '#3a3a4a' : 'transparent',
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <main style={styles.main}>
          <h2 style={styles.pageTitle}>{getPageTitle()}</h2>
          <PageContent
            activePage={activePage}
            onPresentImage={setPresentImage}
            selectedCampaign={selectedCampaign}
            onSelectCampaign={setSelectedCampaign}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
          />
        </main>
      </div>
      
      {presentImage && (
        <PresentMode imageUrl={presentImage} onClose={() => setPresentImage(null)} />
      )}
    </>
  );
}

export default function App() {
  return (
    <CampaignProvider>
      <RecordingProvider>
        <AppContent />
      </RecordingProvider>
    </CampaignProvider>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontFamily: 'system-ui, sans-serif',
    margin: 0,
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#16162a',
    padding: '20px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '10px',
    padding: '0 10px',
    color: '#c9a227',
  },
  logoClickable: {
    cursor: 'pointer',
    userSelect: 'none',
  },
  navDivider: {
    height: '1px',
    backgroundColor: '#3a3a4a',
    margin: '10px 0',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 10px',
    border: 'none',
    borderRadius: '6px',
    color: '#eaeaea',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  navIcon: {
    fontSize: '16px',
  },
  main: {
    flex: 1,
    padding: '30px',
    overflowY: 'auto',
  },
  pageTitle: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#c9a227',
  },
};
