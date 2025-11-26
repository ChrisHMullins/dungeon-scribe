import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';

export default function Campaigns({ onSelectCampaign }) {
  const { campaigns, activeCampaign, createCampaign, deleteCampaign, selectCampaign } = useCampaign();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setCreating(true);
    await createCampaign(newName.trim());
    setNewName('');
    setCreating(false);
  };

  const handleDelete = async (campaign) => {
    if (confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) {
      await deleteCampaign(campaign.id);
    }
  };

  const handleCampaignClick = (campaign) => {
    selectCampaign(campaign);
    if (onSelectCampaign) {
      onSelectCampaign(campaign);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New campaign name..."
          style={styles.input}
          disabled={creating}
        />
        <button type="submit" style={styles.createButton} disabled={creating || !newName.trim()}>
          {creating ? 'Creating...' : 'Create Campaign'}
        </button>
      </form>

      <div style={styles.list}>
        {campaigns.length === 0 ? (
          <p style={styles.empty}>No campaigns yet. Create one to get started!</p>
        ) : (
          campaigns.map((campaign) => (
            <div
              key={campaign.id}
              style={{
                ...styles.card,
                border: `2px solid ${activeCampaign?.id === campaign.id ? '#c9a227' : '#3a3a4a'}`,
              }}
            >
              <div style={styles.cardContent} onClick={() => handleCampaignClick(campaign)}>
                <div style={styles.cardName}>{campaign.name}</div>
                <div style={styles.cardDate}>Created {formatDate(campaign.created)}</div>
                {activeCampaign?.id === campaign.id && (
                  <span style={styles.activeBadge}>Active</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(campaign)}
                style={styles.deleteButton}
                title="Delete campaign"
              >
                ✕
              </button>
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
  },
  createForm: {
    display: 'flex',
    gap: '10px',
    backgroundColor: '#252538',
    padding: '20px',
    borderRadius: '8px',
  },
  input: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    border: '1px solid #3a3a4a',
    borderRadius: '4px',
    fontSize: '14px',
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  empty: {
    color: '#666',
    padding: '20px',
    textAlign: 'center',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#252538',
    padding: '15px 20px',
    borderRadius: '8px',
    border: '2px solid',
    cursor: 'pointer',
  },
  cardContent: {
    flex: 1,
  },
  cardName: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  cardDate: {
    fontSize: '12px',
    color: '#888',
  },
  activeBadge: {
    display: 'inline-block',
    marginTop: '8px',
    padding: '2px 8px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: '#888',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
  },
};

