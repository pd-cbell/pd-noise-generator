import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConfigurationForm } from './components/ConfigurationForm';
import { MonitorDashboard } from './components/MonitorDashboard';
import { AgentBuilder } from './components/AgentBuilder';
import { DirectorDashboard } from './components/DirectorDashboard';
import GoldenDemoLibrary from './components/GoldenDemoLibrary';
import { PresenterDashboard } from './components/PresenterDashboard';
import { Login } from './components/Login';
import MappingProfilesPage from './components/MappingProfilesPage';
import { useAuth } from './contexts/AuthContext';
import { useServerSimulation } from './hooks/useServerSimulation';
import { useStore } from './store/useStore';
import { GoldenDemo } from '../../server/src/types';

function App() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isSimRunning, isLoading: isSimLoading } = useServerSimulation(); 
  const { activeSessionId } = useStore();
  const [activePage, setActivePage] = useState('configure');
  // Removed campaign-related state:
  // const [editingCampaignId, setEditingCampaignId] = useState<string | 'new' | null>(null);
  // const [agentBuiltCampaign, setAgentBuiltCampaign] = useState<Partial<ImportedCampaign> | undefined>(undefined);


  // Auto-switch to presenter view when a session starts
  useEffect(() => {
      if (activeSessionId) {
          setActivePage('presenter');
      }
  }, [activeSessionId]);

  const handleNavigate = (page: string) => {
    // Removed campaign-related state reset:
    // setEditingCampaignId(null); 
    setActivePage(page);
  };

  // Removed campaign-related handlers:
  // const handleEditCampaign = (campaignId: string | 'new') => {
  //   setActivePage('campaigns'); 
  //   setEditingCampaignId(campaignId);
  //   setAgentBuiltCampaign(undefined); 
  // };

  // const handleCloseEditor = () => {
  //   setEditingCampaignId(null);
  //   setAgentBuiltCampaign(undefined);
  // };

  const handleAgentBuildComplete = async (goldenDemo: GoldenDemo) => {
    // The agent service has already saved the Golden Demo.
    // This function might need to be refactored or removed if its sole purpose was to pass to CampaignEditor.
    // For now, it just adds a log indicating the Golden Demo was built.
    console.log("Agent built Golden Demo:", goldenDemo.name);
    // Removed campaign-related logic
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
        {/* Removed campaign-related rendering */}
      </main>
    </div>
  );
}

export default App;
