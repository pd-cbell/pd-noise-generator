import React, { useState } from 'react';
import { Header } from './components/Header';
import { ConfigurationForm } from './components/ConfigurationForm';
import { MonitorDashboard } from './components/MonitorDashboard';
import { CampaignManager } from './components/CampaignManager';
import { CampaignEditor } from './components/CampaignEditor'; // Import CampaignEditor
import { useSimulation } from './hooks/useSimulation';

function App() {
  const [activePage, setActivePage] = useState('campaigns'); // Start on campaigns for testing editor
  const [editingCampaignId, setEditingCampaignId] = useState<string | 'new' | null>(null);
  
  // Initialize simulation engine
  useSimulation();

  const handleNavigate = (page: string) => {
    setEditingCampaignId(null); // Close editor when navigating away
    setActivePage(page);
  };

  const handleEditCampaign = (campaignId: string | 'new') => {
    setActivePage('campaigns'); // Ensure we're on the campaigns tab visually
    setEditingCampaignId(campaignId);
  };

  const handleCloseEditor = () => {
    setEditingCampaignId(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
      <Header activePage={activePage} onNavigate={handleNavigate} />
      
      <main className="flex-1 overflow-auto relative">
        {activePage === 'configure' && <ConfigurationForm />}
        {activePage === 'monitor' && <MonitorDashboard />}
        {activePage === 'campaigns' && (
          editingCampaignId ? (
            <CampaignEditor campaignId={editingCampaignId} onClose={handleCloseEditor} />
          ) : (
            <CampaignManager onEditCampaign={handleEditCampaign} />
          )
        )}
      </main>
    </div>
  );
}

export default App;