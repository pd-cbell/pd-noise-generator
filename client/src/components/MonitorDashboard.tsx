import React from 'react';

export const MonitorDashboard: React.FC = () => {
  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {['Active Incidents', 'Avg. MTTA', 'Avg. MTTR', 'Total Events'].map(label => (
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
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Live Incident Feed</h3>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center text-gray-400 bg-gray-50">
              Table Placeholder
            </div>
         </div>

         {/* Log Viewer */}
         <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 flex flex-col overflow-hidden">
            <div className="p-3 bg-gray-800 border-b border-gray-700">
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">System Log</h3>
            </div>
            <div className="flex-1 p-4 font-mono text-xs text-green-400 overflow-auto">
               <p>[10:00:00] INFO: System ready.</p>
            </div>
         </div>
      </div>
    </div>
  );
};
