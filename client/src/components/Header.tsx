import React from 'react';
import { Activity, Settings, Users, Play, Square, Pause } from 'lucide-react';
import { useStore } from '../store/useStore';

export const Header: React.FC<{ activePage: string; onNavigate: (page: string) => void }> = ({ activePage, onNavigate }) => {
  const { isGenerating, isManaging, startSimulation, pauseSimulation, stopSimulation } = useStore();

  // Derived State
  const isStopped = !isManaging;
  const isPaused = isManaging && !isGenerating;
  const isRunning = isManaging && isGenerating;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shadow-md">
          <Activity className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">PD Noise Simulator</h1>
          <p className="text-xs text-gray-500 font-medium">v1.5 (Gemini Edition)</p>
        </div>
      </div>

      <nav className="flex items-center bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'configure', label: 'Configure', icon: Settings },
          { id: 'monitor', label: 'Monitor', icon: Activity },
          { id: 'campaigns', label: 'Campaigns', icon: Users },
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
           {/* Profile Selector Placeholder */}
           <span className="text-xs text-gray-400 border border-dashed border-gray-300 px-2 py-1 rounded">Default Profile</span>
        </div>
        
        {isStopped && (
          <button
            onClick={startSimulation}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white shadow-md transition-colors bg-green-600 hover:bg-green-700"
          >
            <Play className="w-4 h-4 fill-current" />
            Start
          </button>
        )}

        {(isRunning || isPaused) && (
          <div className="flex gap-2">
            {isRunning ? (
              <button
                onClick={pauseSimulation}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white shadow-md transition-colors bg-yellow-500 hover:bg-yellow-600"
              >
                <Pause className="w-4 h-4 fill-current" />
                Pause
              </button>
            ) : (
              <button
                onClick={startSimulation} // Resume uses start logic (sets both true)
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white shadow-md transition-colors bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume
              </button>
            )}
            
            <button
              onClick={stopSimulation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white shadow-md transition-colors bg-red-600 hover:bg-red-700"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
