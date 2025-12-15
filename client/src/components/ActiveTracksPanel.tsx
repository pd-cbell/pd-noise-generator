import React from 'react';
import { useServerSimulation } from '../hooks/useServerSimulation';
import { Square, Activity, Loader2, X } from 'lucide-react';

interface ActiveTracksPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveTracksPanel: React.FC<ActiveTracksPanelProps> = ({ isOpen, onClose }) => {
  const { currentSimState, stopTrack } = useServerSimulation();

  const scenarioTracks = currentSimState?.tracks?.filter(t => t.type === 'scenario' && t.status === 'running') || [];

  return (
    <div 
      className={`fixed top-20 right-0 w-80 bg-white shadow-xl border-l border-gray-200 h-[calc(100vh-80px)] overflow-y-auto transform transition-transform duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          Active Scenarios
        </h3>
        <div className="flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {scenarioTracks.length}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {scenarioTracks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center italic">No active scenarios running.</p>
        ) : (
          scenarioTracks.map((track) => (
            <div key={track.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative overflow-hidden">
              {/* Status Indicator */}
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-green-500 animate-pulse"></div>
              
              <div className="ml-2">
                <h4 className="text-sm font-bold text-gray-900 truncate" title={track.name}>
                  {track.name || 'Unnamed Scenario'} - <span className="text-gray-500 text-xs font-normal">{track.id.substring(0, 8)}</span>
                </h4>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Running...
                </p>
                
                <div className="mt-3 flex justify-end">
                  <button 
                    className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1 border border-red-200 hover:bg-red-50 rounded px-2 py-1 transition-colors"
                    onClick={() => stopTrack(track.id)}
                  >
                    <Square className="w-3 h-3 fill-current" /> Stop
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
