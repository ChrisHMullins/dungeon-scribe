import React, { createContext, useContext, useState, useEffect } from 'react';

const CampaignContext = createContext({
  campaigns: [],
  activeCampaign: null,
  loading: true,
  loadCampaigns: () => {},
  createCampaign: () => {},
  deleteCampaign: () => {},
  selectCampaign: () => {},
});

export function CampaignProvider({ children }) {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    const result = await window.electronAPI.getCampaigns();
    if (result.success) {
      setCampaigns(result.campaigns);
      // Auto-select first campaign if none selected
      if (result.campaigns.length > 0 && !activeCampaign) {
        setActiveCampaign(result.campaigns[0]);
      }
    }
    setLoading(false);
  };

  const createCampaign = async (name) => {
    const result = await window.electronAPI.createCampaign(name);
    if (result.success) {
      await loadCampaigns();
      setActiveCampaign(result.campaign);
      return result.campaign;
    }
    return null;
  };

  const deleteCampaign = async (campaignId) => {
    const result = await window.electronAPI.deleteCampaign(campaignId);
    if (result.success) {
      if (activeCampaign?.id === campaignId) {
        setActiveCampaign(null);
      }
      await loadCampaigns();
    }
    return result.success;
  };

  const selectCampaign = (campaign) => {
    setActiveCampaign(campaign);
  };

  return (
    <CampaignContext.Provider
      value={{
        campaigns,
        activeCampaign,
        loading,
        loadCampaigns,
        createCampaign,
        deleteCampaign,
        selectCampaign,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  return useContext(CampaignContext);
}

