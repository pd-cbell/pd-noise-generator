import React from 'react';
import { Activity, Settings, Users, Play, Square, Pause } from 'lucide-react';
import { useStore } from '../store/useStore'; // Still need for global config
import { useServerSimulation } from '../hooks/useServerSimulation'; // New

export const Header: React.FC<{ activePage: string; onNavigate: (page: string) => void; isSimRunning: boolean }> = ({ activePage, onNavigate, isSimRunning }) => {
  const { startSimulation, stopSimulation } = useServerSimulation();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shadow-md">
          <Activity className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">PagerDuty Noise Simulator</h1>
          <p className="text-xs text-gray-500 font-medium">v1.8.2 (Gemini Edition)</p>
        </div>
      </div>

      <nav className="flex items-center bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'configure', label: 'Configure', icon: Settings },
          { id: 'monitor', label: 'Monitor', icon: Activity },
          { id: 'campaigns', label: 'Campaigns', icon: Users },
          { id: 'director', label: 'Director', icon: Play },
        ].map((tab) => (
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
           {/* Simulation Status Indicator */}
           <span className={`w-3 h-3 rounded-full ${isSimRunning ? 'bg-green-500' : 'bg-gray-400'}`}></span>
           <span className="text-xs text-gray-500">{isSimRunning ? 'Running' : 'Stopped'}</span>
        </div>
        
        {!isSimRunning ? (
          <button
            onClick={startSimulation}
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
      </div>
    </header>
  );
};
