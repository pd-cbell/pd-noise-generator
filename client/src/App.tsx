import React, { useState } from 'react';
import { Header } from './components/Header';
import { ConfigurationForm } from './components/ConfigurationForm';
import { MonitorDashboard } from './components/MonitorDashboard';
import { CampaignManager } from './components/CampaignManager';
import { CampaignEditor } from './components/CampaignEditor';
import { AgentBuilder } from './components/AgentBuilder';
import { DirectorDashboard } from './components/DirectorDashboard';
import GoldenDemoLibrary from './components/GoldenDemoLibrary'; // New Import
import { PresenterDashboard } from './components/PresenterDashboard'; // New Import
import { Login } from './components/Login';
import { useAuth } from './contexts/AuthContext';
import { useServerSimulation } from './hooks/useServerSimulation';
import { ImportedCampaign, useStore } from './store/useStore';

function App() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isSimRunning, isLoading: isSimLoading } = useServerSimulation(); 
  const { activeSessionId } = useStore(); // Get active session ID
  const [activePage, setActivePage] = useState('configure');
  
  // Auto-switch to presenter view when a session starts
  React.useEffect(() => {
      if (activeSessionId) {
          setActivePage('presenter');
      }
  }, [activeSessionId]);

  const [editingCampaignId, setEditingCampaignId] = useState<string | 'new' | null>(null);
  // ... rest of component
  
  // ...
      <main className="flex-1 overflow-auto relative">
        {activePage === 'configure' && <ConfigurationForm />}
        {activePage === 'monitor' && <MonitorDashboard />}
        {activePage === 'agent' && <AgentBuilder onBuildComplete={handleAgentBuildComplete} />}
        {activePage === 'director' && <DirectorDashboard />}
        {activePage === 'golden-demos' && <GoldenDemoLibrary />} 
        {activePage === 'presenter' && <PresenterDashboard />} {/* New Presenter Page */}
        {activePage === 'campaigns' && (
          editingCampaignId ? (
            <CampaignEditor 
                campaignId={editingCampaignId} 
                initialData={agentBuiltCampaign}
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
