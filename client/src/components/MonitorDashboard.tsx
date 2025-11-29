import React, { useRef, useEffect } from 'react';
import { useStore, IncidentSeverity, Incident } from '../store/useStore'; 
import { TrendChart } from './TrendChart';
import { Activity, PauseCircle, PlayCircle, StopCircle, Zap } from 'lucide-react';
import { useServerSimulation } from '../hooks/useServerSimulation';

export const MonitorDashboard: React.FC = () => {
  const { pdSubdomain } = useStore(); // Only need non-sim state from global store
  const { currentSimState, isSimRunning, ackIncident, resolveIncident, clearActiveIncidents, resolveAllIncidents } = useServerSimulation();
  
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Safely access state from ServerSimulationState
  const activeIncidents = currentSimState?.activeIncidents || [];
  const log = (currentSimState?.log as {ts:string, type:string, msg:string}[]) || [];
  const monitorTrend = currentSimState?.monitorTrend || [];
  const totalEvents = currentSimState?.totalEvents || 0;
  
  // Access metrics from state.metrics
  const metrics = currentSimState?.metrics || {
      avgMtta: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      avgMttr: { global: 0, info: 0, warning: 0, error: 0, critical: 0 },
      apiRpm: 0,
      apiCallsLast60s: 0,
      droppedEvents: 0
  };

  // Auto-scroll for log viewer
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log]);

  const activeIncidentCount = activeIncidents.length;

  const formatDuration = (ms: number) => {
    if (!ms || ms === 0) return '--';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
  };

  const getStatus = () => {
    if (isSimRunning) return { label: 'Running', color: 'text-green-600', icon: PlayCircle };
    return { label: 'Stopped', color: 'text-red-600', icon: StopCircle };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  const [logFilter, setLogFilter] = React.useState<'all'|'info'|'warn'|'error'>('all');

  const filteredLog = log.filter(entry => {
      if (logFilter === 'all') return true;
      return entry.type === logFilter;
  });

  return (
    <div className="p-6 h-full flex flex-col gap-6">
{/* ... */}
         {/* Log Viewer */}
         <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 flex flex-col overflow-hidden">
            <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">System Log</h3>
              <div className="flex gap-1">
                  {(['all', 'info', 'warn', 'error'] as const).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setLogFilter(lvl)}
                        className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                            logFilter === lvl 
                            ? 'bg-gray-600 text-white' 
                            : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                        }`}
                      >
                          {lvl}
                      </button>
                  ))}
              </div>
            </div>
            <div ref={logContainerRef} className="flex-1 p-4 font-mono text-xs text-green-400 overflow-auto">
               {filteredLog.map((entry, index) => (
                 <p key={index} className="whitespace-pre-wrap">
                   <span className="text-gray-500">[{entry.ts}]</span> 
                   <span className={`${entry.type === 'error' ? 'text-red-400' : entry.type === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}> {entry.type.toUpperCase()}: </span>
                   {entry.msg}
                 </p>
               ))}
            </div>
             {/* Trend Chart */}
             <div className="p-3 bg-gray-800 border-t border-gray-700 h-32">
                 <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-2">Active Incidents Trend (last 15m)</h3>
                 <TrendChart data={monitorTrend} height={80} />
             </div>
         </div>
      </div>
    </div>
  );
};