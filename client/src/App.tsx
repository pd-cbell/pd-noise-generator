import React, { useState } from 'react';
import { Header } from './components/Header';
import { ConfigurationForm } from './components/ConfigurationForm';
import { MonitorDashboard } from './components/MonitorDashboard';
import { CampaignManager } from './components/CampaignManager';
import { useSimulation } from './hooks/useSimulation';

function App() {
  const [activePage, setActivePage] = useState('configure');
  
  // Initialize simulation engine
  useSimulation();

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
      <Header activePage={activePage} onNavigate={setActivePage} />
      
      <main className="flex-1 overflow-auto relative">
        {activePage === 'configure' && <ConfigurationForm />}
        {activePage === 'monitor' && <MonitorDashboard />}
        {activePage === 'campaigns' && <CampaignManager />}
      </main>
    </div>
  );
}

export default App;