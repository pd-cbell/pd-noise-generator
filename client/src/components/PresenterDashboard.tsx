import { useEffect, useState } from 'react';
import { useStore, Beat } from '../store/useStore';
import { useServerSimulation } from '../hooks/useServerSimulation';
import { Play, CheckCircle, ChevronRight, Clock, AlertTriangle, StopCircle } from 'lucide-react';
import { api } from '../services/api';

export const PresenterDashboard: React.FC = () => {
  const { activeSessionId, endSession, goldenDemos } = useStore();
  const { currentSimState, stopSimulation } = useServerSimulation();
  
  const [sessionData, setSessionData] = useState<any>(null);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [notes, setNotes] = useState('');

  // Find the Golden Demo associated with the active session
  // We might need to fetch the session details if we don't have the golden demo ID handy
  // For now, let's assume we can get it from the store or fetch it.
  // Actually, useStore doesn't store the full session object, just the ID.
  // We should fetch the session on mount.

  useEffect(() => {
    if (!activeSessionId) return;
    api.getSessions().then((data: any) => {
      const session = data.find((s: any) => s.id === activeSessionId);
      if (session) {
        setSessionData(session);
      }
    });
  }, [activeSessionId]);

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeSessionId) {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSessionId]);

  const activeDemo = goldenDemos.find(d => d.id === sessionData?.goldenDemoId);
  const beats: Beat[] = activeDemo?.configJson?.beats || [];

  const handleNextBeat = () => {
    if (currentBeatIndex < beats.length - 1) {
      setCurrentBeatIndex(prev => prev + 1);
    }
  };

  const handleEndSession = async () => {
    if (window.confirm("Are you sure you want to end the session?")) {
        await endSession(notes);
        stopSimulation();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeSessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="text-xl mb-4">No active session.</p>
        <p>Go to <strong>Golden Demos</strong> or <strong>Director</strong> to launch one.</p>
      </div>
    );
  }

  if (!activeDemo) {
      return <div className="p-8">Loading Session Details...</div>;
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50">
      {/* Top Bar: Timer & Controls */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
                <Play className="w-5 h-5 fill-current" />
                <span>{activeDemo.name}</span>
            </div>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                {activeDemo.maturityLevel}
            </span>
        </div>
        
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-mono text-xl text-gray-700 bg-gray-100 px-3 py-1 rounded">
                <Clock className="w-5 h-5 text-gray-500" />
                {formatTime(sessionDuration)}
            </div>
            
            <button 
                onClick={handleEndSession}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors font-medium"
            >
                <StopCircle className="w-5 h-5" />
                End Session
            </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Narrative Script (Beats) */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200 bg-white">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Narrative Script</h2>
            
            {beats.length === 0 ? (
                <p className="text-gray-500 italic">No beats defined for this demo.</p>
            ) : (
                <div className="space-y-6">
                    {beats.map((beat, index) => {
                        const isActive = index === currentBeatIndex;
                        const isPast = index < currentBeatIndex;
                        
                        return (
                            <div 
                                key={beat.id || index} 
                                className={`relative pl-8 pb-6 border-l-2 ${isActive ? 'border-indigo-500' : isPast ? 'border-green-500' : 'border-gray-200'}`}
                            >
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white
                                    ${isActive ? 'border-indigo-500 text-indigo-500' : isPast ? 'border-green-500 text-green-500' : 'border-gray-300 text-gray-300'}
                                `}>
                                    {isPast ? <CheckCircle className="w-3 h-3" /> : <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-500' : ''}`} />}
                                </div>

                                <div className={`${isActive ? 'opacity-100' : 'opacity-60'} transition-opacity`}>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{beat.title}</h3>
                                    <p className="text-sm text-gray-600 mb-3">{beat.description}</p>
                                    
                                    {/* Presenter Cues */}
                                    <div className="space-y-3">
                                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                            <span className="block text-xs font-bold text-blue-700 uppercase mb-1">Say</span>
                                            <p className="text-sm text-blue-900 leading-relaxed">{beat.whatToSay}</p>
                                        </div>
                                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
                                            <span className="block text-xs font-bold text-yellow-700 uppercase mb-1">Show</span>
                                            <p className="text-sm text-yellow-900 leading-relaxed">{beat.whatToShowInPagerDuty}</p>
                                        </div>
                                    </div>

                                    {isActive && (
                                        <div className="mt-4">
                                            <button 
                                                onClick={handleNextBeat}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm"
                                            >
                                                Next Step <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Right: Real-time Metrics & Notes */}
        <div className="w-1/2 flex flex-col bg-gray-50">
            {/* Live Metrics */}
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Live Simulation State
                </h2>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-sm text-gray-500">Active Incidents</span>
                        <div className="text-3xl font-bold text-gray-900 mt-1">
                            {currentSimState?.activeIncidents.length || 0}
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-sm text-gray-500">Total Events</span>
                        <div className="text-3xl font-bold text-indigo-600 mt-1">
                            {currentSimState?.totalEvents || 0}
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-sm text-gray-500">MTTA (Global)</span>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                            {((currentSimState as any)?.metrics?.avgMtta?.global / 1000 || 0).toFixed(1)}s
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-sm text-gray-500">MTTR (Global)</span>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                            {((currentSimState as any)?.metrics?.avgMttr?.global / 1000 || 0).toFixed(1)}s
                        </div>
                    </div>
                </div>
            </div>

            {/* Session Notes */}
            <div className="flex-1 p-6 flex flex-col min-h-0">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Session Notes</h2>
                <textarea
                    className="flex-1 w-full p-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm leading-relaxed"
                    placeholder="Capture questions, follow-ups, or observations..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>
        </div>
      </div>
    </div>
  );
};
