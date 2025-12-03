import React, { useState } from 'react';
import { Header } from './components/Header';
import { ConfigurationForm } from './components/ConfigurationForm';
import { MonitorDashboard } from './components/MonitorDashboard';
import { CampaignManager } from './components/CampaignManager';
import { CampaignEditor } from './components/CampaignEditor';
import { Login } from './components/Login';
import { DirectorDashboard } from './components/DirectorDashboard';
import { useAuth } from './contexts/AuthContext';
import { useServerSimulation } from './hooks/useServerSimulation';

function App() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isSimRunning, isLoading: isSimLoading } = useServerSimulation(); // New
  const [activePage, setActivePage] = useState('configure');
  const [editingCampaignId, setEditingCampaignId] = useState<string | 'new' | null>(null);
  
  // No longer using browser-side simulation engine directly here

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

  if (isAuthLoading || isSimLoading) { // Check both auth and sim loading
    return <div className="h-screen flex items-center justify-center text-gray-500">Loading Session...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
      <Header 
        activePage={activePage} 
        onNavigate={handleNavigate} 
        isSimRunning={isSimRunning} // Pass to Header
      />
      
      <main className="flex-1 overflow-auto relative">
        {activePage === 'configure' && <ConfigurationForm />}
        {activePage === 'monitor' && <MonitorDashboard />}
        {activePage === 'director' && <DirectorDashboard />}
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
