import React from 'react';
import { useStore } from '../store/useStore';
import { Loader2 } from 'lucide-react'; 

export const ConfigurationForm: React.FC = () => {
  const { 
    pdSubdomain, apiToken, globalRoutingKey, fromEmail, 
    setCredentials,
    fetchTeams, fetchServices, fetchEscalationPolicies,
    isLoadingTeams, isLoadingServices, isLoadingEscalationPolicies,
    addLog,
    teams, services, escalationPolicies, 
    selectedTeamIds, setSelectedTeamIds, setServiceInclude
  } = useStore();

  const handleLoadPagerDutyData = async () => {
    if (!apiToken || !pdSubdomain) {
      addLog('API Token and PagerDuty Subdomain are required to load data.', 'warn');
      return;
    }
    // Fetching sequentially to ensure teams are available for services/EPs filtering
    await fetchTeams();
    await fetchServices();
    await fetchEscalationPolicies();
  };

  const isDataLoading = isLoadingTeams || isLoadingServices || isLoadingEscalationPolicies;

  return (
    <div className="p-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Organization & Credentials</h2>
        <div className="space-y-4">
          <div>
             <label htmlFor="pdSubdomain" className="block text-sm font-medium text-gray-700 mb-1">PagerDuty Subdomain</label>
             <input 
               id="pdSubdomain"
               type="text" 
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" 
               placeholder="subdomain"
               value={pdSubdomain}
               onChange={(e) => setCredentials({ pdSubdomain: e.target.value })}
             />
          </div>
          <div>
             <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 mb-1">REST API Token</label>
             <input 
               id="apiToken"
               type="password" 
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" 
               placeholder="y_..."
               value={apiToken}
               onChange={(e) => setCredentials({ apiToken: e.target.value })}
             />
          </div>
          <div>
             <label htmlFor="globalRoutingKey" className="block text-sm font-medium text-gray-700 mb-1">Global Event Routing Key</label>
             <input 
               id="globalRoutingKey"
               type="text" 
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" 
               placeholder="xxxx..."
               value={globalRoutingKey}
               onChange={(e) => setCredentials({ globalRoutingKey: e.target.value })}
             />
          </div>
          <div>
             <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700 mb-1">From Email (PagerDuty User)</label>
             <input 
               id="fromEmail"
               type="email" 
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" 
               placeholder="user@example.com"
               value={fromEmail}
               onChange={(e) => setCredentials({ fromEmail: e.target.value })}
             />
          </div>
          <div className="pt-2">
            <button
              onClick={handleLoadPagerDutyData}
              disabled={!apiToken || !pdSubdomain || isDataLoading}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold text-white transition-colors
                ${(!apiToken || !pdSubdomain)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'}
              `}
            >
              {isDataLoading && <Loader2 className="animate-spin h-5 w-5" />}
              {isDataLoading ? 'Loading Data...' : 'Load PagerDuty Data'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Simulation Settings</h2>
        <div className="space-y-4">
           <p className="text-sm text-gray-500">Rate, probabilities, and timing configurations will go here.</p>
        </div>
      </div>

      {/* --- Teams Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Teams ({teams.length})</h2>
        {isLoadingTeams && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-green-500" />
            <span className="ml-2 text-gray-600">Loading Teams...</span>
          </div>
        )}
        {!isLoadingTeams && teams.length === 0 && (apiToken && pdSubdomain) && (
          <p className="text-gray-500">No teams found or loaded. Click "Load PagerDuty Data".</p>
        )}
        {!isLoadingTeams && teams.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
            {teams.map((team) => (
              <label key={team.id} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-green-600 rounded"
                  checked={selectedTeamIds.includes(team.id)}
                  onChange={(e) => {
                    const newSelectedTeamIds = e.target.checked
                      ? [...selectedTeamIds, team.id]
                      : selectedTeamIds.filter((id) => id !== team.id);
                    setSelectedTeamIds(newSelectedTeamIds);
                  }}
                />
                <span className="ml-2 text-gray-700">{team.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* --- Services Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Services ({services.length})</h2>
        {isLoadingServices && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-green-500" />
            <span className="ml-2 text-gray-600">Loading Services...</span>
          </div>
        )}
        {!isLoadingServices && services.length === 0 && (apiToken && pdSubdomain) && (
          <p className="text-gray-500">No services found or loaded. Select teams and click "Load PagerDuty Data".</p>
        )}
        {!isLoadingServices && services.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
            {services.map((service) => (
              <label key={service.id} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-green-600 rounded"
                  checked={service.include}
                  onChange={(e) => setServiceInclude(service.id, e.target.checked)}
                />
                <span className="ml-2 text-gray-700">{service.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* --- Escalation Policies Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Escalation Policies ({escalationPolicies.length})</h2>
        {isLoadingEscalationPolicies && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-green-500" />
            <span className="ml-2 text-gray-600">Loading Escalation Policies...</span>
          </div>
        )}
        {!isLoadingEscalationPolicies && escalationPolicies.length === 0 && (apiToken && pdSubdomain) && (
          <p className="text-gray-500">No escalation policies found or loaded. Click "Load PagerDuty Data".</p>
        )}
        {!isLoadingEscalationPolicies && escalationPolicies.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
            {escalationPolicies.map((ep) => (
              <label key={ep.id} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-green-600 rounded"
                  // No specific 'include' state for EPs in original, so just display for now
                  readOnly // Make it read-only for now if no interaction is defined
                />
                <span className="ml-2 text-gray-700">{ep.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
