import React, { useEffect, useMemo, useState } from 'react';
import { Play, Layers, AlertTriangle, Loader2, ListEnd } from 'lucide-react'; // Added ListEnd icon
import { useStore, GoldenDemo, MappingProfile } from '../store/useStore';
import { useServerSimulation } from '../hooks/useServerSimulation';
import { GoldenDemoDetailModal } from './GoldenDemoDetailModal';
import { ActiveTracksPanel } from './ActiveTracksPanel';

export const DirectorDashboard: React.FC = () => {
  const { addLog, goldenDemos, fetchGoldenDemos, isLoadingGoldenDemos, mappingProfiles, fetchMappingProfiles, selectedMappingProfileId, setSelectedMappingProfileId } = useStore();
  const { injectGoldenDemo } = useServerSimulation();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<GoldenDemo | null>(null);
  const [isActiveTracksPanelOpen, setIsActiveTracksPanelOpen] = useState(false); // New state for panel

  useEffect(() => {
    const loadDemos = async () => {
      setIsLoading(true);
      await Promise.all([fetchGoldenDemos(), fetchMappingProfiles()]);
      setIsLoading(false);
    };
    loadDemos();
  }, [fetchGoldenDemos, fetchMappingProfiles]);

  const selectedProfile: MappingProfile | null = useMemo(
    () => mappingProfiles.find((p) => p.id === selectedMappingProfileId) || null,
    [mappingProfiles, selectedMappingProfileId]
  );

  const handleLaunch = (demo: GoldenDemo) => {
    injectGoldenDemo(demo.configJson.items, selectedMappingProfileId || undefined);

    addLog(
      `Injecting Golden Demo: "${demo.name}"${selectedProfile ? ` with mapping profile "${selectedProfile.name}"` : ''}`,
      'info'
    );
    setIsActiveTracksPanelOpen(true); // Open panel when demo is launched
  };

  const handleCardClick = (demo: GoldenDemo) => {
    setSelectedDemo(demo);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDemo(null);
  };

  const [filterVertical, setFilterVertical] = useState<string>('');
  const [filterMaturity, setFilterMaturity] = useState<string>('');

  const filteredDemos = goldenDemos.filter(demo => {
    const matchesVertical = filterVertical ? demo.vertical === filterVertical : true;
    const matchesMaturity = filterMaturity ? demo.maturityLevel === filterMaturity : true;
    return matchesVertical && matchesMaturity;
  });

  const uniqueVerticals = Array.from(new Set(goldenDemos.map(demo => demo.vertical)));
  const uniqueMaturityLevels = Array.from(new Set(goldenDemos.map(demo => demo.maturityLevel)));

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
            <div className="p-2 bg-indigo-100 rounded-lg">
                <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900">Director Soundboard</h1>
                <p className="text-xs text-gray-500">Launch Curated Golden Demos</p>
            </div>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Mapping Profile</label>
                <select
                    className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    value={selectedMappingProfileId || ''}
                    onChange={(e) => setSelectedMappingProfileId(e.target.value || null)}
                >
                    <option value="">No mapping profile</option>
                    {mappingProfiles.map(profile => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                </select>
                <div className="mt-1 text-xs text-gray-500">
                    Profile: {selectedProfile ? selectedProfile.name : 'None'}{selectedProfile ? ` • Mapped: ${selectedProfile.serviceMappings?.length || 0}` : ''}{selectedProfile?.globalIncidentRoutingKey ? ` • RK: ${selectedProfile.globalIncidentRoutingKey}` : ''}
                </div>
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Vertical</label>
                <select
                    className="w-36 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    value={filterVertical}
                    onChange={(e) => setFilterVertical(e.target.value)}
                >
                    <option value="">All</option>
                    {uniqueVerticals.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Maturity Level</label>
                <select
                    className="w-36 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    value={filterMaturity}
                    onChange={(e) => setFilterMaturity(e.target.value)}
                >
                    <option value="">All</option>
                    {uniqueMaturityLevels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
             {/* Toggle for Active Tracks Panel */}
            <button
                onClick={() => setIsActiveTracksPanelOpen(!isActiveTracksPanelOpen)}
                className={`flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                    isActiveTracksPanelOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
            >
                <ListEnd className="w-4 h-4" />
                <span>Active Tracks</span>
            </button>
        </div>
      </div>

      {/* Main Grid */}
      {isLoading || isLoadingGoldenDemos ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <Loader2 className="animate-spin inline-block mr-2" size={20} /> Loading Golden Demos...
          </div>
      ) : filteredDemos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              No Golden Demos found matching your criteria.
          </div>
      ) : (
          <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredDemos.map(demo => (
                      <div 
                          key={demo.id} 
                          className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => handleCardClick(demo)} // Make the card clickable
                      >
                          {/* Golden Demo Header */}
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-gray-400" />
                              <h3 className="font-bold text-gray-800 truncate" title={demo.name}>{demo.name}</h3>
                          </div>
                          
                          {/* Golden Demo Details */}
                          <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                              <div>
                                  <p className="text-xs text-gray-500">Vertical: <span className="font-medium text-gray-700">{demo.vertical}</span></p>
                                  <p className="text-xs text-gray-500">Maturity: <span className="font-medium text-gray-700">{demo.maturityLevel}</span></p>
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-3">{demo.narrative}</p>
                              </div>
                              
                              <button
                                  onClick={(e) => { e.stopPropagation(); handleLaunch(demo); }} // Prevent modal from opening when launching
                                  className={`w-full py-2 rounded flex items-center justify-center gap-2 text-sm font-semibold transition-colors
                                      bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-100 hover:border-green-600
                                  }`}
                              >
                                  <Play className="w-4 h-4 fill-current" />
                                  Launch Demo
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {selectedDemo && (
        <GoldenDemoDetailModal
          isOpen={isModalOpen}
          onClose={closeModal}
          demo={selectedDemo}
          selectedMappingProfile={selectedProfile}
          onLaunch={handleLaunch}
        />
      )}
      <ActiveTracksPanel isOpen={isActiveTracksPanelOpen} onClose={() => setIsActiveTracksPanelOpen(false)} />
    </div>
  );
};
