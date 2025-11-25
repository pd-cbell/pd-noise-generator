import React, { useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Incident } from '../store/useStore'; 
import { TrendChart } from './TrendChart';

export const MonitorDashboard: React.FC = () => {
  const { activeIncidents, log, monitorTrend, clearActiveIncidents, addLog } = useStore();
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll for log viewer
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log]);

  const activeIncidentCount = activeIncidents.length;

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Active Incidents</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeIncidentCount}</p>
        </div>
        {['Avg. MTTA', 'Avg. MTTR', 'Total Events'].map(label => (
           <div key={label} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">--</p>
           </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
         {/* Incident Table */}
         <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Live Incident Feed</h3>
              <button
                onClick={() => {
                  clearActiveIncidents();
                  addLog('Cleared all active incidents locally.', 'info');
                }}
                disabled={!activeIncidentCount}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !activeIncidentCount
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Clear List
              </button>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{incident.severity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {incident.incidentId ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {incident.incidentId}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Pending...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(incident.startedAt).toLocaleTimeString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           <button 
                             disabled={!incident.incidentId}
                             className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             Ack
                           </button>
                           <button 
                             disabled={!incident.incidentId}
                             className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
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

