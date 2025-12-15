import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Loader2, Save, Search, Eye, EyeOff, FolderInput } from 'lucide-react'; 
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
  const [isMapModalOpen, setIsMapModalOpen] = useState(false); // Modal state

  // Computed visible teams
  const visibleTeams = useMemo(() => {
// ... existing code ...
  }, [teams, teamFilterText, showDemoSlices]);

  // Computed visible services
  const visibleServices = useMemo(() => {
// ... existing code ...
  }, [services, serviceFilterText, showDemoSlices]);

  useEffect(() => {
// ... existing code ...
  }, [credentials]);

  const handleSaveToProfile = async () => {
// ... existing code ...
  };

  const handleLoadTeams = async () => {
// ... existing code ...
  };

  const handleLoadServicesAndEPs = async () => {
// ... existing code ...
  };

  const handleToggleAllTeams = () => {
// ... existing code ...
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
      {/* ... existing code ... */}
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Simulation Settings</h2>
        {/* ... existing code ... */}
      </div>

      {/* --- Teams Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        {/* ... existing code ... */}
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

        {/* ... existing code ... */}
      </div>

      {/* --- Escalation Policies Section --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
        {/* ... existing code ... */}
      </div>

      <AddToProfileModal 
        isOpen={isMapModalOpen} 
        onClose={() => setIsMapModalOpen(false)} 
        selectedServices={services.filter(s => s.include)} 
      />
    </div>
  );
};
