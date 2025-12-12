import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConfigurationForm } from './components/ConfigurationForm';
import { MonitorDashboard } from './components/MonitorDashboard';
import { CampaignManager } from './components/CampaignManager';
import { CampaignEditor } from './components/CampaignEditor';
import { AgentBuilder } from './components/AgentBuilder';
import { DirectorDashboard } from './components/DirectorDashboard';
import GoldenDemoLibrary from './components/GoldenDemoLibrary';
import { PresenterDashboard } from './components/PresenterDashboard';
import { Login } from './components/Login';
import MappingProfilesPage from './components/MappingProfilesPage';
import { useAuth } from './contexts/AuthContext';
import { useServerSimulation } from './hooks/useServerSimulation';
import { ImportedCampaign, useStore } from './store/useStore';
import { GoldenDemo } from '../../server/src/types';

function App() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isSimRunning, isLoading: isSimLoading } = useServerSimulation(); 
  const { activeSessionId } = useStore();
  const [activePage, setActivePage] = useState('configure');
  const [editingCampaignId, setEditingCampaignId] = useState<string | 'new' | null>(null);
  const [agentBuiltCampaign, setAgentBuiltCampaign] = useState<Partial<ImportedCampaign> | undefined>(undefined);


  // Auto-switch to presenter view when a session starts
  useEffect(() => {
      if (activeSessionId) {
          setActivePage('presenter');
      }
  }, [activeSessionId]);

  const handleNavigate = (page: string) => {
    setEditingCampaignId(null); // Close editor when navigating away
    setActivePage(page);
  };

  const handleEditCampaign = (campaignId: string | 'new') => {
    setActivePage('campaigns'); // Ensure we're on the campaigns tab visually
    setEditingCampaignId(campaignId);
    setAgentBuiltCampaign(undefined); // Clear previous agent build
  };

  const handleCloseEditor = () => {
    setEditingCampaignId(null);
    setAgentBuiltCampaign(undefined);
  };

  const handleAgentBuildComplete = async (goldenDemo: GoldenDemo) => {
    // The agent service has already saved the Golden Demo.
    // We just need to extract the campaign part and pass it to the CampaignEditor.
    
    const campaignData = goldenDemo.configJson as any; // Cast to any to access items safely
    
    // Map to ImportedCampaign structure (same logic as in AgentBuilder.tsx's handleBuild)
    const newCampaignForEditor = {
        id: 'new', // Editor will handle ID generation or saving as a new variant
        name: campaignData.name,
        description: campaignData.description,
        source: `AI Agent (${goldenDemo.name})`, // Use GoldenDemo name as source
        items: campaignData.items?.map((item: any) => ({
            ...item,
            payloadString: JSON.stringify(item.payload || {}, null, 2),
            times: item.repeatCount || 1, 
        })) || []
    };

    setAgentBuiltCampaign(newCampaignForEditor);
    setActivePage('campaigns');
    setEditingCampaignId('new');
  };

  if (isAuthLoading || isSimLoading) {
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
        isSimRunning={isSimRunning} 
      />
      
      <main className="flex-1 overflow-auto relative">
        {activePage === 'configure' && <ConfigurationForm />}
        {activePage === 'monitor' && <MonitorDashboard />}
        {activePage === 'agent' && <AgentBuilder onBuildComplete={handleAgentBuildComplete} />}
        {activePage === 'director' && <DirectorDashboard />}
        {activePage === 'mapping-profiles' && <MappingProfilesPage />}
        {activePage === 'golden-demos' && <GoldenDemoLibrary />}
        {activePage === 'presenter' && <PresenterDashboard />}
        {activePage === 'campaigns' && (
          editingCampaignId ? (
            <CampaignEditor 
                campaignId={editingCampaignId} 
                initialData={agentBuiltCampaign} // This will need re-evaluation as agent now returns GoldenDemo
                onClose={handleCloseEditor} 
            />
          ) : (
            <CampaignManager onEditCampaign={handleEditCampaign} />
          )
        )}
      </main>
    </div>
  );
}

export default App;
