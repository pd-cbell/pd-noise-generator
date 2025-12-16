import { Activity, Settings, Play, Square, Bot, Layers, Map as MapIcon, Shield } from 'lucide-react';
import { useServerSimulation } from '../hooks/useServerSimulation'; // New
import { useAuth, UserRole } from '../contexts/AuthContext';

export const Header: React.FC<{ activePage: string; onNavigate: (page: string) => void; isSimRunning: boolean }> = ({ activePage, onNavigate, isSimRunning }) => {
  const { startSimulation, stopSimulation, socketStatus, socketError, isLoading } = useServerSimulation();
  const { user } = useAuth();

  const navItems = [
    { id: 'configure', label: 'Configure', icon: Settings },
    { id: 'monitor', label: 'Monitor', icon: Activity },
    { id: 'golden-demos', label: 'Golden Demos', icon: Layers },
    { id: 'agent', label: 'Agent', icon: Bot },
    { id: 'director', label: 'Director', icon: Layers },
    { id: 'mapping-profiles', label: 'Mapping Profiles', icon: MapIcon },
  ];

  if (user?.role === UserRole.ADMIN) {
    navItems.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shadow-md">
          <Activity className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">PagerDuty Noise Simulator</h1>
          <p className="text-xs text-gray-500 font-medium">v2.3.1 (Golden Demo Platform)</p>
        </div>
      </div>

      <nav className="flex items-center bg-gray-100 p-1 rounded-lg">
        {navItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${activePage === tab.id 
                ? 'bg-white text-green-700 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
           <span className={`w-3 h-3 rounded-full ${
             socketStatus === 'connected' ? 'bg-green-500' :
             socketStatus === 'connecting' ? 'bg-yellow-400' :
             socketStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
           }`}></span>
           <span className="text-xs text-gray-500">
             {socketStatus === 'connected' ? (isSimRunning ? 'Running' : 'Ready') :
              socketStatus === 'connecting' ? 'Connecting...' :
              socketStatus === 'error' ? 'Socket Error' :
              'Disconnected'}
           </span>
        </div>
        
        {!isSimRunning ? (
          <button
            onClick={() => startSimulation()}
            disabled={socketStatus !== 'connected' || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white shadow-md transition-colors bg-green-600 hover:bg-green-700"
          >
            <Play className="w-4 h-4 fill-current" />
            Start
          </button>
        ) : (
          <button
            onClick={stopSimulation}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white shadow-md transition-colors bg-red-600 hover:bg-red-700"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop
          </button>
        )}
        {socketError && (
          <span className="text-xs text-red-600">{socketError}</span>
        )}
      </div>
    </header>
  );
};
