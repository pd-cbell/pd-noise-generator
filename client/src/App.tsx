import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConfigurationForm } from './components/ConfigurationForm';
import { MonitorDashboard } from './components/MonitorDashboard';
import { AgentBuilder } from './components/AgentBuilder';
import { DirectorDashboard } from './components/DirectorDashboard';
import { AdminDashboard } from './components/AdminDashboard'; // Import AdminDashboard
import GoldenDemoLibrary from './components/GoldenDemoLibrary';
import { PresenterDashboard } from './components/PresenterDashboard';
import { Login } from './components/Login';
import MappingProfilesPage from './components/MappingProfilesPage';
import { useAuth, UserRole } from './contexts/AuthContext'; // Import UserRole
import { useServerSimulation } from './hooks/useServerSimulation';
import { useStore } from './store/useStore';
import { GoldenDemo } from './store/useStore';

function App() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isSimRunning, isLoading: isSimLoading } = useServerSimulation(); 
  const { activeSessionId } = useStore();
  const [activePage, setActivePage] = useState('configure');

  // Auto-switch to presenter view when a session starts
  useEffect(() => {
      if (activeSessionId) {
          setActivePage('presenter');
      }
  }, [activeSessionId]);

  const handleNavigate = (page: string) => {
    setActivePage(page);
  };

  const handleAgentBuildComplete = async (goldenDemo: GoldenDemo) => {
    console.log("Agent built Golden Demo:", goldenDemo.name);
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
        {activePage === 'admin' && user.role === UserRole.ADMIN && <AdminDashboard />}
      </main>
    </div>
  );
}

export default App;
