import React, { useRef, useEffect } from 'react';
import { useStore, IncidentSeverity } from '../store/useStore';
import { Incident } from '../store/useStore'; 
import { TrendChart } from './TrendChart';
import { Activity, PauseCircle, PlayCircle, StopCircle, Zap } from 'lucide-react';

export const MonitorDashboard: React.FC = () => {
  const { 
    activeIncidents, log, monitorTrend, clearActiveIncidents, addLog, 
    avgMtta, avgMttr, totalEvents, apiRpm, apiCallsLast60s, droppedEvents,
    isGenerating, isManaging
  } = useStore();
  
  const logContainerRef = useRef<HTMLDivElement>(null);

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
    if (isGenerating && isManaging) return { label: 'Running', color: 'text-green-600', icon: PlayCircle };
    if (!isGenerating && isManaging) return { label: 'Paused', color: 'text-yellow-600', icon: PauseCircle };
    return { label: 'Stopped', color: 'text-red-600', icon: StopCircle };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Activity & Status */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Active Incidents</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{activeIncidentCount}</p>
            </div>
            <div className={`flex items-center gap-1 ${status.color} bg-opacity-10 px-2 py-1 rounded-full bg-current`}>
              <StatusIcon className="w-4 h-4" />
              <span className="text-xs font-bold">{status.label}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-end">
             <div>
                <p className="text-xs text-gray-400 font-medium">TOTAL EVENTS</p>
                <p className="text-lg font-semibold text-gray-700">{totalEvents}</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-gray-400 font-medium">API RPM</p>
                <div className="flex items-center gap-1 text-indigo-600">
                   <Zap className="w-3 h-3" />
                   <span className="text-lg font-bold">{apiRpm}</span>
                   {apiCallsLast60s !== undefined && apiCallsLast60s !== null && (
                     <span className="ml-1 text-xs text-gray-500 font-medium">({apiCallsLast60s} in 60s)</span>
                   )}
                </div>
             </div>
          </div>
        </div>

        {/* Card 2: MTTA Breakdown */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 font-medium mb-2">Avg. Time to Ack (MTTA)</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-gray-100 pb-1">
               <span className="text-xs font-bold text-gray-700">Global</span>
               <span className="text-sm font-bold text-gray-900">{formatDuration(avgMtta.global)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
               <div>
                 <span className="block text-gray-400">Warn</span>
                 <span className="font-medium text-yellow-700">{formatDuration(avgMtta.warning)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Error</span>
                 <span className="font-medium text-orange-700">{formatDuration(avgMtta.error)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Crit</span>
                 <span className="font-medium text-red-700">{formatDuration(avgMtta.critical)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Card 3: MTTR Breakdown */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 font-medium mb-2">Avg. Time to Resolve (MTTR)</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-gray-100 pb-1">
               <span className="text-xs font-bold text-gray-700">Global</span>
               <span className="text-sm font-bold text-gray-900">{formatDuration(avgMttr.global)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
               <div>
                 <span className="block text-gray-400">Warn</span>
                 <span className="font-medium text-yellow-700">{formatDuration(avgMttr.warning)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Error</span>
                 <span className="font-medium text-orange-700">{formatDuration(avgMttr.error)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Crit</span>
                 <span className="font-medium text-red-700">{formatDuration(avgMttr.critical)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Card 4: Simulation Health */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
           <p className="text-sm text-gray-500 font-medium mb-2">Health & Trends</p>
           <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                 <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dropped Events</span>
                 <span className={`text-xl font-bold ${droppedEvents > 0 ? 'text-red-600' : 'text-gray-700'}`}>{droppedEvents}</span>
              </div>
              <p className="text-xs text-gray-400">Incidents failed to map after retry (30s).</p>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
         {/* Incident Table */}
         <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Live Incident Feed</h3>
              <div className="flex gap-2">
                <button
                  onClick={clearActiveIncidents}
                  disabled={!activeIncidentCount}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    !activeIncidentCount
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Clear List (Local)
                </button>
                <button
                  onClick={() => useStore.getState().resolveAllIncidents()}
                  disabled={!activeIncidentCount}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    !activeIncidentCount
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  Resolve All (API)
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {activeIncidents.length === 0 ? (
                <div className="p-4 text-center text-gray-500 bg-gray-50 h-full flex items-center justify-center">
                  No active incidents.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incident ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeIncidents.map((incident: Incident) => (
                      <tr key={incident.dedupKey}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{incident.serviceName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            incident.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            incident.severity === 'error' ? 'bg-orange-100 text-orange-800' :
                            incident.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {incident.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {incident.incidentId ? (
                            <a href={`https://${useStore.getState().pdSubdomain}.pagerduty.com/incidents/${incident.incidentId}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              {incident.incidentId}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Pending...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(incident.startedAt).toLocaleTimeString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           <button 
                             onClick={() => useStore.getState().ackIncident(incident.dedupKey)}
                             disabled={!incident.incidentId || incident.acked}
                             className={`mr-3 font-medium ${!incident.incidentId || incident.acked ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-900'}`}
                           >
                             {incident.acked ? 'Acked' : 'Ack'}
                           </button>
                           <button 
                             onClick={() => useStore.getState().resolveIncident(incident.dedupKey)}
                             disabled={!incident.incidentId}
                             className={`font-medium ${!incident.incidentId ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                           >
                             Resolve
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
         </div>

         {/* Log Viewer */}
         <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 flex flex-col overflow-hidden">
            <div className="p-3 bg-gray-800 border-b border-gray-700">
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">System Log</h3>
            </div>
            <div ref={logContainerRef} className="flex-1 p-4 font-mono text-xs text-green-400 overflow-auto">
               {log.map((entry, index) => (
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

