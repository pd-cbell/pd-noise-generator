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
  const { activeSessionId, upsertGoldenDemo, requestEditGoldenDemo } = useStore();
  const [activePage, setActivePage] = useState('configure');
  const agentEnabled = user?.agentEnabled !== false;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isViewer = user?.role === UserRole.VIEWER;

  const allowedPages = (() => {
    if (!user) return [];
    if (isAdmin) {
      return [
        'configure',
        'monitor',
        'golden-demos',
        ...(agentEnabled ? ['agent'] : []),
        'director',
        'mapping-profiles',
        'presenter',
        'admin',
      ];
    }
    if (isViewer) {
      return ['golden-demos', 'director', 'mapping-profiles', 'presenter'];
    }
    return [
      'configure',
      'golden-demos',
      ...(agentEnabled ? ['agent'] : []),
      'director',
      'mapping-profiles',
      'presenter',
    ];
  })();

  // Auto-switch to presenter view when a session starts
  useEffect(() => {
      if (activeSessionId) {
          setActivePage('presenter');
      }
  }, [activeSessionId]);
  useEffect(() => {
    if (user && allowedPages.length > 0 && !allowedPages.includes(activePage)) {
      setActivePage(allowedPages[0]);
    }
  }, [user, allowedPages, activePage]);

  const handleNavigate = (page: string) => {
    setActivePage(page);
  };

  const handleAgentBuildComplete = async (goldenDemo: GoldenDemo) => {
    console.log("Agent built Golden Demo:", goldenDemo.name);
    upsertGoldenDemo(goldenDemo);
    requestEditGoldenDemo(goldenDemo.id);
    setActivePage('golden-demos');
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
        {activePage === 'configure' && user.role !== UserRole.VIEWER && <ConfigurationForm />}
        {activePage === 'monitor' && user.role === UserRole.ADMIN && <MonitorDashboard />}
        {activePage === 'agent' && agentEnabled && user.role !== UserRole.VIEWER && (
          <AgentBuilder onBuildComplete={handleAgentBuildComplete} />
        )}
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
