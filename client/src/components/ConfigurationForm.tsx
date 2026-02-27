import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Loader2, Save, Search, Eye, EyeOff, FolderInput, CheckCircle, XCircle } from 'lucide-react';
import { SeverityTabs } from './SeverityTabs'; 
import { useAuth } from '../contexts/AuthContext';
import { AddToProfileModal } from './AddToProfileModal';

export const ConfigurationForm: React.FC = () => {
  const { 
    pdSubdomain, apiToken, globalRoutingKey, fromEmail, 
    setCredentials,
    fetchTeams, fetchServices, fetchEscalationPolicies,
    isLoadingTeams, isLoadingServices, isLoadingEscalationPolicies,
    addLog,
    teams, services, escalationPolicies, 
    selectedTeamIds, setSelectedTeamIds, setServiceInclude,
    selectedEPIds, setSelectedEPIds
  } = useStore();

  const { credentials, updateCredentials } = useAuth();
  
  // UI State for filtering
  const [teamFilterText, setTeamFilterText] = useState('');
  const [serviceFilterText, setServiceFilterText] = useState('');
  const [showDemoSlices, setShowDemoSlices] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Computed visible teams
  const visibleTeams = useMemo(() => {
      return teams.filter(team => {
          // 1. Name Filter
          if (teamFilterText && !team.name.toLowerCase().includes(teamFilterText.toLowerCase())) {
              return false;
          }
          // 2. Demo Slice Filter
          if (!showDemoSlices) {
              if (team.name.startsWith("NOC - ") || team.name.startsWith("SRE - ")) {
                  return false;
              }
          }
          return true;
      });
  }, [teams, teamFilterText, showDemoSlices]);

  // Computed visible services
  const visibleServices = useMemo(() => {
      return services.filter(svc => {
          // 1. Name Filter
          if (serviceFilterText && !svc.name.toLowerCase().includes(serviceFilterText.toLowerCase())) {
              return false;
          }
          // 2. Demo Slice Filter (Check service name OR team names)
          if (!showDemoSlices) {
              // Check if service belongs to a hidden team or has a hidden name prefix itself
              const hasVisibleTeam = svc.teams.some(t => !t.name.startsWith("NOC - ") && !t.name.startsWith("SRE - "));
              // If service has teams, at least one must be visible. If no teams, assume visible unless name matches.
              if (svc.teams.length > 0 && !hasVisibleTeam) return false;
              
              if (svc.name.startsWith("NOC - ") || svc.name.startsWith("SRE - ")) return false;
          }
          return true;
      });
  }, [services, serviceFilterText, showDemoSlices]);

  useEffect(() => {
    if (credentials) {
        if (!apiToken && credentials.apiToken) setCredentials({ apiToken: credentials.apiToken });
        if (!globalRoutingKey && credentials.globalRoutingKey) setCredentials({ globalRoutingKey: credentials.globalRoutingKey });
        if (!fromEmail && credentials.fromEmail) setCredentials({ fromEmail: credentials.fromEmail });
    }
  }, [credentials]);

  const handleSaveToProfile = async () => {
      if (!apiToken && !globalRoutingKey && !fromEmail) {
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
          return;
      }
      setSaveStatus('saving');
      try {
          await updateCredentials({ apiToken, globalRoutingKey, fromEmail });
          setSaveStatus('success');
          setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) {
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
      }
  };

  const handleLoadTeams = async () => {
    if (!apiToken || !pdSubdomain) {
      addLog('API Token and PagerDuty Subdomain are required to load teams.', 'warn');
      return;
    }
    await fetchTeams();
  };

  const handleLoadServicesAndEPs = async () => {
    if (selectedTeamIds.length === 0) {
      addLog('Please select at least one team to load services.', 'warn');
      return;
    }
    await fetchServices();
    await fetchEscalationPolicies();
  };

  const handleToggleAllServices = () => {
    if (visibleServices.length === 0) return;
    const allSelected = visibleServices.every(s => s.include);
    visibleServices.forEach(s => setServiceInclude(s.id, !allSelected));
  };

  const isTeamsLoading = isLoadingTeams;
  const isServicesLoading = isLoadingServices || isLoadingEscalationPolicies;
  const checkedServicesCount = services.filter(s => s.include).length;

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
             <label htmlFor="pdRegion" className="block text-sm font-medium text-gray-700 mb-1">PagerDuty Region</label>
             <select
               id="pdRegion"
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
               value={useStore(state => state.pdRegion)}
               onChange={(e) => setCredentials({ pdRegion: e.target.value as 'US' | 'EU' | 'STAGING' })}
             >
               <option value="US">US (api.pagerduty.com)</option>
               <option value="EU">EU (api.eu.pagerduty.com)</option>
               <option value="STAGING">Staging (api.pd-staging.com)</option>
             </select>
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
          <div className="pt-2 flex gap-2">
            <button
              onClick={handleSaveToProfile}
              disabled={saveStatus === 'saving'}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold transition-colors border
                ${saveStatus === 'success' ? 'bg-green-50 text-green-700 border-green-300' :
                  saveStatus === 'error' ? 'bg-red-50 text-red-700 border-red-300' :
                  saveStatus === 'saving' ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed' :
                  'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'}`}
            >
              {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveStatus === 'success' && <CheckCircle className="w-4 h-4" />}
              {saveStatus === 'error' && <XCircle className="w-4 h-4" />}
              {saveStatus === 'idle' && <Save className="w-4 h-4" />}
              {saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'success' ? 'Saved!' :
               saveStatus === 'error' ? 'Save Failed' :
               'Save to Profile'}
            </button>
            <button
              onClick={handleLoadTeams}
              disabled={!apiToken || !pdSubdomain || isTeamsLoading}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold text-white transition-colors
                ${(!apiToken || !pdSubdomain)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'}
              `}
            >
              {isTeamsLoading && <Loader2 className="animate-spin h-5 w-5" />}
              {isTeamsLoading ? 'Loading Teams...' : 'Load Teams'}
            </button>
          </div>
        </div>
      </div>
      
      {/* --- Teams Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg font-semibold text-gray-800">Teams ({visibleTeams.length} / {teams.length})</h2>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative">
                  <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
                  <input 
                      type="text"
                      placeholder="Filter teams..."
                      className="w-full sm:w-48 pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none"
                      value={teamFilterText}
                      onChange={(e) => setTeamFilterText(e.target.value)}
                  />
              </div>

              {/* Demo Toggle */}
              <button
                  onClick={() => setShowDemoSlices(!showDemoSlices)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                      showDemoSlices ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
              >
                  {showDemoSlices ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {showDemoSlices ? 'Hide Demo Slices' : 'Show Demo Slices'}
              </button>

              {visibleTeams.length > 0 && (
                <button 
                  onClick={() => {
                      const visibleIds = visibleTeams.map(t => t.id);
                      const allVisibleSelected = visibleIds.every(id => selectedTeamIds.includes(id));
                      if (allVisibleSelected) {
                          setSelectedTeamIds(selectedTeamIds.filter(id => !visibleIds.includes(id)));
                      } else {
                          setSelectedTeamIds(Array.from(new Set([...selectedTeamIds, ...visibleIds])));
                      }
                  }}
                  className="text-sm text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                >
                  Select All Visible
                </button>
              )}
          </div>
        </div>
        
        {isTeamsLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-green-500" />
            <span className="ml-2 text-gray-600">Loading Teams...</span>
          </div>
        )}
        {!isTeamsLoading && teams.length === 0 && (apiToken && pdSubdomain) && (
          <p className="text-gray-500">No teams found or loaded. Click "Load Teams".</p>
        )}
        {!isTeamsLoading && visibleTeams.length === 0 && teams.length > 0 && (
            <p className="text-gray-500 text-sm italic p-4 text-center">No teams match your filter.</p>
        )}
        {!isTeamsLoading && visibleTeams.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2 mb-4">
            {visibleTeams.map((team) => (
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
                <span className="ml-2 text-gray-700 truncate" title={team.name}>{team.name}</span>
              </label>
            ))}
          </div>
        )}
        
        {teams.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
             <button
              onClick={handleLoadServicesAndEPs}
              disabled={isServicesLoading} // Removed selectedTeamIds.length === 0 check to allow loading ALL
              className={`
                flex items-center justify-center gap-2 px-6 py-2 rounded-md font-semibold text-white transition-colors
                ${isServicesLoading
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'}
              `}
            >
              {isServicesLoading && <Loader2 className="animate-spin h-5 w-5" />}
              {isServicesLoading ? 'Loading Services & Policies...' : 'Load Services & Policies (All Loaded Teams)'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
                Note: This loads services for <strong>all loaded teams</strong> ({teams.length}), enabling them for Campaign usage even if not selected for Noise simulation.
            </p>
          </div>
        )}
      </div>

      {/* --- Services Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg font-semibold text-gray-800">Services ({visibleServices.length} / {services.length})</h2>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                  <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
                  <input 
                      type="text"
                      placeholder="Filter services..."
                      className="w-full sm:w-48 pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none"
                      value={serviceFilterText}
                      onChange={(e) => setServiceFilterText(e.target.value)}
                  />
              </div>
              
              {services.length > 0 && (
                <>
                  <button
                    onClick={() => setIsMapModalOpen(true)}
                    disabled={checkedServicesCount === 0}
                    className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                        checkedServicesCount > 0 ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <FolderInput className="w-3 h-3" />
                    Add Checked ({checkedServicesCount}) to Profile
                  </button>

                  <button 
                    onClick={handleToggleAllServices}
                    className="text-sm text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                  >
                    {visibleServices.every(s => s.include) ? 'Deselect Visible' : 'Select Visible'}
                  </button>
                </>
              )}
          </div>
        </div>

        {isServicesLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-green-500" />
            <span className="ml-2 text-gray-600">Loading Services...</span>
          </div>
        )}
        {!isServicesLoading && services.length === 0 && selectedTeamIds.length > 0 && (
          <p className="text-gray-500">No services found. Click "Load Services & Policies".</p>
        )}
        {!isServicesLoading && services.length === 0 && selectedTeamIds.length === 0 && (
          <p className="text-gray-500">Select teams above to load services.</p>
        )}
        {!isServicesLoading && visibleServices.length === 0 && services.length > 0 && (
            <p className="text-gray-500 text-sm italic p-4 text-center">No services match your filter.</p>
        )}
        {!isServicesLoading && visibleServices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
            {visibleServices.map((service) => (
              <label key={service.id} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-green-600 rounded"
                  checked={service.include}
                  onChange={(e) => setServiceInclude(service.id, e.target.checked)}
                />
                <span className="ml-2 text-gray-700 truncate" title={service.name}>{service.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* --- Escalation Policies Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Escalation Policies ({escalationPolicies.length})</h2>
          {escalationPolicies.length > 0 && (
            <button 
              onClick={() => {
                if (selectedEPIds.length === escalationPolicies.length) {
                  setSelectedEPIds([]);
                } else {
                  setSelectedEPIds(escalationPolicies.map(ep => ep.id));
                }
              }}
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              {selectedEPIds.length === escalationPolicies.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        {isServicesLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-green-500" />
            <span className="ml-2 text-gray-600">Loading Escalation Policies...</span>
          </div>
        )}
        {!isServicesLoading && escalationPolicies.length === 0 && selectedTeamIds.length > 0 && (
          <p className="text-gray-500">No escalation policies found. Click "Load Services & Policies".</p>
        )}
        {!isServicesLoading && escalationPolicies.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
            {escalationPolicies.map((ep) => (
              <label key={ep.id} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-green-600 rounded"
                  checked={selectedEPIds.includes(ep.id)}
                  onChange={(e) => {
                    const newSelectedEPIds = e.target.checked
                      ? [...selectedEPIds, ep.id]
                      : selectedEPIds.filter((id) => id !== ep.id);
                    setSelectedEPIds(newSelectedEPIds);
                  }}
                />
                <span className="ml-2 text-gray-700">{ep.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Simulation Settings</h2>
        
        <div className="space-y-6">
          {/* Global Throughput */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Global Throughput</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ratePerMinute" className="block text-sm font-medium text-gray-700 mb-1">Incident Rate (per minute)</label>
                <input
                  id="ratePerMinute"
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                  value={useStore(state => state.ratePerMinute)}
                  onChange={(e) => useStore.getState().setSettings({ ratePerMinute: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Per-Severity Settings Tabs */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Per-Severity Behavior</h3>
            <SeverityTabs />
          </div>

          {/* Global Auto-Action & Healing */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Global Auto-Action & Healing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex items-center gap-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex items-center">
                  <input
                    id="autoHealEnabled"
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-green-600 rounded"
                    checked={useStore(state => state.autoHealConfig.enabled)}
                    onChange={(e) => useStore.getState().setSettings({ 
                      autoHealConfig: { ...useStore.getState().autoHealConfig, enabled: e.target.checked } 
                    })}
                  />
                  <label htmlFor="autoHealEnabled" className="ml-2 text-sm font-medium text-gray-700">Enable Auto-Heal (Warnings)</label>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="healProb" className="text-sm text-gray-600">Prob:</label>
                  <input
                    id="healProb"
                    type="number"
                    step="0.1"
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    value={useStore(state => state.autoHealConfig.warningProbability)}
                    onChange={(e) => useStore.getState().setSettings({ 
                      autoHealConfig: { ...useStore.getState().autoHealConfig, warningProbability: Number(e.target.value) } 
                    })}
                  />
                </div>
              </div>
              <div className="md:col-span-2 flex items-center">
                 <input
                    id="resumeExisting"
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-green-600 rounded"
                    checked={useStore(state => state.resumeExistingEnabled)}
                    onChange={(e) => useStore.getState().setSettings({ resumeExistingEnabled: e.target.checked })}
                  />
                  <label htmlFor="resumeExisting" className="ml-2 text-sm font-medium text-gray-700">Resume existing incidents on start</label>
              </div>
            </div>
          </div>

          {/* Event Bursting Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Event Bursting</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="burstProbability" className="block text-sm font-medium text-gray-700">Burst Probability</label>
                  <span className="text-sm font-medium text-gray-900">{(useStore(state => state.burstProbability * 100)).toFixed(0)}%</span>
                </div>
                <input
                  id="burstProbability"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  value={useStore(state => state.burstProbability)}
                  onChange={(e) => useStore.getState().setSettings({ burstProbability: Number(e.target.value) })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  If triggered, sends 2-7 events every 10-40s. Stops on resolve.
                </p>
              </div>
            </div>
          </div>

          {/* Realism & Chaos (v1.8) */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Realism & Chaos (v1.8)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="majorIncidentProbability" className="block text-sm font-medium text-gray-700">Major Incident Probability</label>
                  <span className="text-sm font-medium text-gray-900">{(useStore(state => state.majorIncidentProbability * 100)).toFixed(0)}%</span>
                </div>
                <input
                  id="majorIncidentProbability"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  value={useStore(state => state.majorIncidentProbability)}
                  onChange={(e) => useStore.getState().setSettings({ majorIncidentProbability: Number(e.target.value) })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  % of Team Failure scenarios that become Major (P1/P2).
                </p>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="responderAckRate" className="block text-sm font-medium text-gray-700">Responder Ack Rate</label>
                  <span className="text-sm font-medium text-gray-900">{(useStore(state => state.responderAckRate * 100)).toFixed(0)}%</span>
                </div>
                <input
                  id="responderAckRate"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  value={useStore(state => state.responderAckRate)}
                  onChange={(e) => useStore.getState().setSettings({ responderAckRate: Number(e.target.value) })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Simulates human error. Lower = more missed acks.
                </p>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="teamFailureProbability" className="block text-sm font-medium text-gray-700">Team Failure Probability</label>
                  <span className="text-sm font-medium text-gray-900">{(useStore(state => state.teamFailureProbability * 100)).toFixed(1)}%</span>
                </div>
                <input
                  id="teamFailureProbability"
                  type="range"
                  min="0"
                  max="0.05"
                  step="0.001"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  value={useStore(state => state.teamFailureProbability)}
                  onChange={(e) => useStore.getState().setSettings({ teamFailureProbability: Number(e.target.value) })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Prob. of correlated team-wide failure scenarios.
                </p>
              </div>
            </div>
          </div>

          {/* Severity Distribution */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Severity Weights (Must sum to ~1.0)</h3>
            <div className="grid grid-cols-4 gap-2">
              {['info', 'warning', 'error', 'critical'].map(sev => (
                <div key={sev}>
                  <label htmlFor={`sev-${sev}`} className="block text-xs font-medium text-gray-500 capitalize mb-1">{sev}</label>
                  <input
                    id={`sev-${sev}`}
                    type="number"
                    step="0.05"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    value={useStore(state => state.severityWeights[sev as keyof typeof state.severityWeights])}
                    onChange={(e) => useStore.getState().setSettings({ 
                      severityWeights: { ...useStore.getState().severityWeights, [sev]: Number(e.target.value) } 
                    })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Observability Mix */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Observability Payload Mix</h3>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(useStore.getState().sourceMix).map(source => (
                <div key={source}>
                  <label htmlFor={`mix-${source}`} className="block text-xs font-medium text-gray-500 capitalize mb-1">{source}</label>
                  <input
                    id={`mix-${source}`}
                    type="number"
                    step="0.05"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    value={useStore(state => state.sourceMix[source])}
                    onChange={(e) => useStore.getState().setSettings({ 
                      sourceMix: { ...useStore.getState().sourceMix, [source]: Number(e.target.value) } 
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AddToProfileModal 
        isOpen={isMapModalOpen} 
        onClose={() => setIsMapModalOpen(false)} 
        selectedServices={services.filter(s => s.include)} 
      />
    </div>
  );
};
