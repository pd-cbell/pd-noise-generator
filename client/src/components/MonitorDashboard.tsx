import React, { useRef, useEffect } from 'react';
import { useStore, Incident } from '../store/useStore'; 
import { TrendChart } from './TrendChart';
import { PlayCircle, StopCircle, Zap } from 'lucide-react';
import { useServerSimulation } from '../hooks/useServerSimulation';

export const MonitorDashboard: React.FC = () => {
  const { pdSubdomain, pdRegion, trackRunsById, selectedTrackRunId, setSelectedTrackRunId, activeTrackRunId, goldenDemos } = useStore();
  const { currentSimState, isSimRunning, socketStatus, socketError, reconnectSocket, requestSimState, stopTrack, ackIncident, resolveIncident, clearActiveIncidents, resolveAllIncidents } = useServerSimulation();
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [selectedTrackId, setSelectedTrackId] = React.useState<string>('all');
  const tracks = currentSimState?.tracks || [];

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
  const majorIncidentCount = activeIncidents.filter(i => i.isMajor).length;

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

  const trackRuns = Object.values(trackRunsById || {}).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  const selectedRunId =
    selectedTrackRunId && selectedTrackRunId !== 'all'
      ? selectedTrackRunId
      : activeTrackRunId || trackRuns[0]?.trackRunId || null;
  const selectedRun = selectedRunId ? trackRunsById[selectedRunId] : null;
  const selectedRunDemo = selectedRun?.goldenDemoId
    ? goldenDemos.find((demo) => demo.id === selectedRun.goldenDemoId)
    : null;
  const runIncidents = Object.values(selectedRun?.incidentsByDedupKey || {}).sort((a, b) => {
    const aTs = a.lastUpdatedAt ? Date.parse(a.lastUpdatedAt) : 0;
    const bTs = b.lastUpdatedAt ? Date.parse(b.lastUpdatedAt) : 0;
    return bTs - aTs;
  });
  const runSentEvents = selectedRun?.sentEvents || [];

  const formatTs = (ts?: number | string) => {
    if (!ts) return '--';
    const value = typeof ts === 'string' ? Date.parse(ts) : ts;
    return Number.isNaN(value) ? '--' : new Date(value).toLocaleTimeString();
  };
  const pagerDutyAppHost = pdRegion === 'STAGING' ? 'pd-staging.com' : 'pagerduty.com';
  const showTrackRunsPanel = false;

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {(socketStatus !== 'connected' || socketError) && (
        <div className="p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-800 flex justify-between items-center">
          <div>
            <strong>Monitor not connected.</strong>{' '}
            {socketError ? `(${socketError})` : 'Awaiting socket connection to simulation.'}
          </div>
          <button
            className="px-3 py-1 text-xs font-semibold text-yellow-900 bg-yellow-200 rounded hover:bg-yellow-300"
            onClick={reconnectSocket}
          >
            Reconnect
          </button>
        </div>
      )}
      {socketStatus === 'connected' && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold">Active tracks:</span>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
            >
              <option value="all">All</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.name || t.id}</option>
              ))}
            </select>
            {selectedTrackId !== 'all' && (
              <button
                className="px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-100 border border-red-200 rounded hover:bg-red-200"
                onClick={() => stopTrack(selectedTrackId)}
              >
                Stop Track
              </button>
            )}
          </div>
          <button
            className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200"
            onClick={requestSimState}
          >
            Sync State
          </button>
        </div>
      )}

      {showTrackRunsPanel && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">Golden Demo Track Runs</div>
              <div className="text-xs text-gray-500">Lifecycle events from `track_run_*` telemetry</div>
            </div>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
              value={selectedRunId || ''}
              onChange={(e) => setSelectedTrackRunId(e.target.value || null, 'manual')}
            >
              <option value="">Latest active</option>
              {trackRuns.map((run) => {
                const demoName = run.goldenDemoId
                  ? goldenDemos.find((demo) => demo.id === run.goldenDemoId)?.name
                  : null;
                return (
                <option key={run.trackRunId} value={run.trackRunId}>
                  {run.trackRunId.slice(0, 6)} • {demoName || run.goldenDemoId || 'Unknown'}
                </option>
                );
              })}
            </select>
          </div>
          {!selectedRun && <div className="text-xs text-gray-500">No track runs yet.</div>}
          {selectedRun && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-100 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Summary</div>
                <div className="text-sm text-gray-800">Demo: {selectedRunDemo?.name || selectedRun.goldenDemoId || 'Unknown'}</div>
                <div className="text-sm text-gray-600">Started: {formatTs(selectedRun.startedAt)}</div>
                <div className="text-sm text-gray-600">Status: {selectedRun.isActive ? 'Active' : 'Finished'}</div>
                <div className="text-sm text-gray-600">Events Sent: {runSentEvents.length}</div>
                <div className="text-sm text-gray-600">Incidents: {runIncidents.length}</div>
              </div>
              <div className="border border-gray-100 rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Incidents</div>
                {runIncidents.length === 0 ? (
                  <div className="text-xs text-gray-500">No incidents recorded yet.</div>
                ) : (
                  <div className="space-y-2">
                    {runIncidents.map((inc) => (
                      <div key={inc.dedupKey} className="text-xs text-gray-700">
                        <span className="font-semibold">{inc.status || 'unknown'}</span> • {inc.serviceName || 'Service'} •{' '}
                        {inc.title || inc.dedupKey}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border border-gray-100 rounded-lg p-3 max-h-40 overflow-y-auto md:col-span-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Event Timeline</div>
                {runSentEvents.length === 0 ? (
                  <div className="text-xs text-gray-500">No events sent yet.</div>
                ) : (
                  <div className="space-y-2">
                    {runSentEvents.map((evt) => (
                      <div key={evt.id} className="text-xs text-gray-700">
                        <span className="font-semibold">{formatTs(evt.sentAt)}</span> • {evt.type} •{' '}
                        {evt.logicalServiceName} • {evt.status}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Golden Demo lifecycle view intentionally removed (tracking still active under the hood) */}
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
                   <span className="text-lg font-bold">{Math.round(metrics.apiRpm)}</span>
                   {metrics.apiCallsLast60s !== undefined && (
                     <span className="ml-1 text-xs text-gray-500 font-medium">({metrics.apiCallsLast60s} in 60s)</span>
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
               <span className="text-sm font-bold text-gray-900">{formatDuration(metrics.avgMtta.global)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
               <div>
                 <span className="block text-gray-400">Warn</span>
                 <span className="font-medium text-yellow-700">{formatDuration(metrics.avgMtta.warning)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Error</span>
                 <span className="font-medium text-orange-700">{formatDuration(metrics.avgMtta.error)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Crit</span>
                 <span className="font-medium text-red-700">{formatDuration(metrics.avgMtta.critical)}</span>
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
               <span className="text-sm font-bold text-gray-900">{formatDuration(metrics.avgMttr.global)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
               <div>
                 <span className="block text-gray-400">Warn</span>
                 <span className="font-medium text-yellow-700">{formatDuration(metrics.avgMttr.warning)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Error</span>
                 <span className="font-medium text-orange-700">{formatDuration(metrics.avgMttr.error)}</span>
               </div>
               <div>
                 <span className="block text-gray-400">Crit</span>
                 <span className="font-medium text-red-700">{formatDuration(metrics.avgMttr.critical)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Card 4: Simulation Health */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
           <p className="text-sm text-gray-500 font-medium mb-2">Health & Trends</p>
           <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                 <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Major Incidents</span>
                 <span className={`text-xl font-bold ${majorIncidentCount > 0 ? 'text-red-600' : 'text-gray-700'}`}>{majorIncidentCount}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dropped Events</span>
                 <span className={`text-xl font-bold ${metrics.droppedEvents > 0 ? 'text-red-600' : 'text-gray-700'}`}>{metrics.droppedEvents}</span>
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
                  onClick={() => clearActiveIncidents()} 
                  disabled={!activeIncidentCount}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    !activeIncidentCount
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Clear List (Server)
                </button>
                <button
                  onClick={() => resolveAllIncidents()}
                  disabled={!activeIncidentCount}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    !activeIncidentCount
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  Resolve All (Server)
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
                    {activeIncidents.map((incident: Incident) => {
                      const isTeamFailure = incident.failureSummary?.startsWith("Team Failure");
                      const rowClass = incident.isMajor 
                        ? 'bg-red-50 border-l-4 border-red-500' 
                        : isTeamFailure 
                          ? 'bg-yellow-50 border-l-4 border-yellow-400' 
                          : '';

                      return (
                        <tr key={incident.dedupKey} className={rowClass}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {incident.serviceName}
                              {incident.isMajor && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">MAJOR</span>}
                              {!incident.isMajor && isTeamFailure && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">TEAM</span>}
                          </td>
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
                              <a href={`https://${pdSubdomain}.${pagerDutyAppHost}/incidents/${incident.incidentId}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                {incident.incidentId}
                              </a>
                            ) : (
                              <span className="text-gray-400 italic">Pending...</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(incident.startedAt).toLocaleTimeString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                             <button 
                               onClick={() => ackIncident(incident.dedupKey)}
                               disabled={!incident.incidentId || incident.acked}
                               className={`mr-3 font-medium ${!incident.incidentId || incident.acked ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-900'}`}
                             >
                               {incident.acked ? 'Acked' : 'Ack'}
                             </button>
                             <button 
                               onClick={() => resolveIncident(incident.dedupKey)}
                               disabled={!incident.incidentId}
                               className={`font-medium ${!incident.incidentId ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                             >
                               Resolve
                             </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
         </div>

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
