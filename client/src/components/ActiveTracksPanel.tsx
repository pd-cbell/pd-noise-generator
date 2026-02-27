import React from 'react';
import { useServerSimulation } from '../hooks/useServerSimulation';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { Square, Activity, Loader2, X } from 'lucide-react';

interface ActiveTracksPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveTracksPanel: React.FC<ActiveTracksPanelProps> = ({ isOpen, onClose }) => {
  const { currentSimState, stopTrack } = useServerSimulation();
  const { trackRunsById, goldenDemos, mappingProfiles } = useStore();
  const { impersonatorId } = useAuth();

  const runByTrackId = Object.values(trackRunsById || {}).reduce<Record<string, {
    goldenDemoId?: string | null;
    mappingProfileId?: string | null;
    runId: string;
  }>>((acc, run) => {
    if (!run.trackId) return acc;
    acc[run.trackId] = {
      goldenDemoId: run.goldenDemoId || null,
      mappingProfileId: run.mappingProfileId || null,
      runId: run.trackRunId,
    };
    return acc;
  }, {});

  const scenarioTracks = currentSimState?.tracks?.filter(t => t.type === 'scenario' && t.status === 'running') || [];
  const sharedScenarioRuns = Object.values(trackRunsById || {})
    .filter(run => run.isActive && run.trackId)
    .map(run => ({
      id: run.trackId as string,
      name: run.goldenDemoId
        ? goldenDemos.find(demo => demo.id === run.goldenDemoId)?.name
        : null as string | null,
      runId: run.trackRunId,
      goldenDemoId: run.goldenDemoId || null,
      mappingProfileId: run.mappingProfileId || null,
      source: 'shared-run' as const,
    }));

  const combinedScenarioTracks = [
    ...scenarioTracks.map(track => ({
      id: track.id,
      name: track.name,
      runId: runByTrackId[track.id]?.runId,
      goldenDemoId: runByTrackId[track.id]?.goldenDemoId || null,
      mappingProfileId: runByTrackId[track.id]?.mappingProfileId || null,
      source: 'session-track' as const,
    })),
    ...sharedScenarioRuns,
  ].reduce<Array<{
    id: string;
    name?: string | null;
    runId?: string;
    goldenDemoId?: string | null;
    mappingProfileId?: string | null;
    source: 'session-track' | 'shared-run';
  }>>((acc, track) => {
    const existingIdx = acc.findIndex((t) => t.id === track.id);
    if (existingIdx === -1) {
      acc.push(track);
      return acc;
    }
    const existing = acc[existingIdx];
    acc[existingIdx] = {
      ...existing,
      ...track,
      name: track.name || existing.name,
      runId: existing.runId || track.runId,
      goldenDemoId: existing.goldenDemoId || track.goldenDemoId,
      mappingProfileId: existing.mappingProfileId || track.mappingProfileId,
      source: existing.source === 'session-track' || track.source === 'session-track' ? 'session-track' : 'shared-run',
    };
    return acc;
  }, []);

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
            {combinedScenarioTracks.length}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {combinedScenarioTracks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center italic">No active scenarios running.</p>
        ) : (
          combinedScenarioTracks.map((track) => (
            <div key={track.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative overflow-hidden">
              {/* Status Indicator */}
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-green-500 animate-pulse"></div>
              
              <div className="ml-2">
                <h4 className="text-sm font-bold text-gray-900 truncate" title={track.name || undefined}>
                  {track.name || 'Unnamed Scenario'} - <span className="text-gray-500 text-xs font-normal">{track.id.substring(0, 8)}</span>
                </h4>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Running...
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                    Scenario: {track.goldenDemoId
                      ? (goldenDemos.find((demo) => demo.id === track.goldenDemoId)?.name || 'Unknown')
                      : (track.name || 'Unknown')}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    track.source === 'session-track'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {track.source === 'session-track' ? 'Owned by current session' : 'Shared-subdomain run'}
                  </span>
                  {impersonatorId && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                      Impersonating
                    </span>
                  )}
                  {track.mappingProfileId && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                      Profile: {mappingProfiles.find((p) => p.id === track.mappingProfileId)?.name || 'Mapped'}
                    </span>
                  )}
                </div>
                
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
