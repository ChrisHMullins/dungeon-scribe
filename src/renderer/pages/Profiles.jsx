import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';

const PROFILE_TYPES = ['Character', 'NPC', 'Monster', 'Place', 'Item'];

export default function Profiles() {
  const { activeCampaign } = useCampaign();
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'NPC', description: '' });

  useEffect(() => {
    if (activeCampaign) {
      loadProfiles();
    }
  }, [activeCampaign]);

  const loadProfiles = async () => {
    if (!activeCampaign) return;
    const result = await window.electronAPI.getProfiles(activeCampaign.id);
    if (result.success) {
      setProfiles(result.profiles);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    const result = await window.electronAPI.createProfile(activeCampaign.id, formData);
    if (result.success) {
      setFormData({ name: '', type: 'NPC', description: '' });
      setShowForm(false);
      await loadProfiles();
    }
  };

  const handleUpdate = async () => {
    if (!selectedProfile) return;
    
    await window.electronAPI.updateProfile(
      activeCampaign.id,
      selectedProfile.id,
      { description: selectedProfile.description }
    );
    await loadProfiles();
  };

  const handleDelete = async (profile) => {
    if (confirm(`Delete profile "${profile.name}"?`)) {
      await window.electronAPI.deleteProfile(activeCampaign.id, profile.id);
      if (selectedProfile?.id === profile.id) {
        setSelectedProfile(null);
      }
      await loadProfiles();
    }
  };

  if (!activeCampaign) {
    return (
      <div style={styles.empty}>
        <p>Select a campaign first to manage profiles.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h3 style={styles.sidebarTitle}>Profiles</h3>
          <button onClick={() => setShowForm(true)} style={styles.addButton}>+</button>
        </div>
        
        {profiles.length === 0 ? (
          <p style={styles.emptyList}>No profiles yet</p>
        ) : (
          <div style={styles.profileList}>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                onClick={() => setSelectedProfile(profile)}
                style={{
                  ...styles.profileItem,
                  backgroundColor: selectedProfile?.id === profile.id ? '#3a3a4a' : 'transparent',
                }}
              >
                <span style={styles.profileType}>{profile.type}</span>
                <span style={styles.profileName}>{profile.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.content}>
        {showForm ? (
          <form onSubmit={handleCreate} style={styles.form}>
            <h3 style={styles.formTitle}>New Profile</h3>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Name"
              style={styles.input}
            />
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              style={styles.select}
            >
              {PROFILE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description..."
              style={styles.textarea}
              rows={5}
            />
            <div style={styles.formButtons}>
              <button type="button" onClick={() => setShowForm(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button type="submit" style={styles.submitButton}>Create</button>
            </div>
          </form>
        ) : selectedProfile ? (
          <div style={styles.profileDetail}>
            <div style={styles.profileHeader}>
              <div>
                <span style={styles.detailType}>{selectedProfile.type}</span>
                <h2 style={styles.detailName}>{selectedProfile.name}</h2>
              </div>
              <button onClick={() => handleDelete(selectedProfile)} style={styles.deleteButton}>
                Delete
              </button>
            </div>
            <div style={styles.detailSection}>
              <label style={styles.label}>Description</label>
              <textarea
                value={selectedProfile.description || ''}
                onChange={(e) => setSelectedProfile({ ...selectedProfile, description: e.target.value })}
                onBlur={handleUpdate}
                style={styles.textarea}
                rows={8}
                placeholder="Add a description..."
              />
            </div>
            <div style={styles.detailSection}>
              <label style={styles.label}>Images</label>
              <p style={styles.placeholder}>No images yet. Images will be generated during sessions.</p>
            </div>
          </div>
        ) : (
          <p style={styles.placeholder}>Select a profile or create a new one</p>
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
  sidebar: {
    width: '250px',
    backgroundColor: '#252538',
    borderRadius: '8px',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  sidebarTitle: {
    fontSize: '14px',
    color: '#c9a227',
    margin: 0,
  },
  addButton: {
    width: '28px',
    height: '28px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '4px',
    fontSize: '18px',
    cursor: 'pointer',
  },
  profileList: {
    flex: 1,
    overflowY: 'auto',
  },
  profileItem: {
    padding: '10px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '5px',
  },
  profileType: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '2px',
  },
  profileName: {
    fontSize: '14px',
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
  empty: {
    color: '#666',
    textAlign: 'center',
    padding: '40px',
  },
  placeholder: {
    color: '#666',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxWidth: '400px',
  },
  formTitle: {
    color: '#c9a227',
    marginBottom: '10px',
  },
  input: {
    padding: '12px',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    border: '1px solid #3a3a4a',
    borderRadius: '4px',
    fontSize: '14px',
  },
  select: {
    padding: '12px',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    border: '1px solid #3a3a4a',
    borderRadius: '4px',
    fontSize: '14px',
  },
  textarea: {
    padding: '12px',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    border: '1px solid #3a3a4a',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  formButtons: {
    display: 'flex',
    gap: '10px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#3a3a4a',
    color: '#eaeaea',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#c9a227',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  profileDetail: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  profileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailType: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
  },
  detailName: {
    fontSize: '24px',
    color: '#c9a227',
    margin: '5px 0 0 0',
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
  },
};

