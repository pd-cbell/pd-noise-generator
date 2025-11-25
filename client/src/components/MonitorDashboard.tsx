import React, { useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Incident } from '../store/useStore'; // Import Incident type for better typing

export const MonitorDashboard: React.FC = () => {
  const { activeIncidents, log, monitorTrend, clearActiveIncidents, isRunning, addLog } = useStore();
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
        {/* Other KPIs will be populated as logic is migrated */}
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
                  addLog('Cleared all active incidents.', 'info');
                }}
                disabled={!activeIncidentCount}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !activeIncidentCount
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Resolve All
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dedupe Key</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeIncidents.map((incident: Incident) => (
                      <tr key={incident.dedupKey}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{incident.serviceName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{incident.severity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{incident.dedupKey.substring(0, 8)}...</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(incident.startedAt).toLocaleTimeString()}</td>
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
             {/* Trend Chart Placeholder */}
             <div className="p-3 bg-gray-800 border-t border-gray-700">
                 <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mt-2">Active Incidents Trend (last 15m)</h3>
                 <pre className="text-[10px] text-gray-600 overflow-x-auto">
                   {JSON.stringify(monitorTrend.map(d => ({t: new Date(d.ts).toLocaleTimeString(), c: d.count})), null, 2)}
                 </pre>
             </div>
         </div>
      </div>
    </div>
  );
};
