import React, { useEffect, useState } from 'react';
import { Play, Layers, AlertTriangle, Zap, CheckCircle, X, Loader2 } from 'lucide-react';
import { useStore, GoldenDemo } from '../store/useStore'; // Import GoldenDemo type
import { useServerSimulation } from '../hooks/useServerSimulation'; // New import

export const DirectorDashboard: React.FC = () => {
  const { addLog, goldenDemos, fetchGoldenDemos, isLoadingGoldenDemos } = useStore();
  const { startSimulation } = useServerSimulation(); // Get startSimulation from hook
  
  const [isLoading, setIsLoading] = useState(true); // Control local loading state

  useEffect(() => {
    const loadDemos = async () => {
      setIsLoading(true);
      await fetchGoldenDemos();
      setIsLoading(false);
    };
    loadDemos();
  }, [fetchGoldenDemos]);

  const handleLaunch = (demo: GoldenDemo) => {
    // Stop any currently running simulation
    // This is handled implicitly by useServerSimulation which will reset
    
    // Extract configJson from the GoldenDemo
    const simulationConfig = demo.configJson;

    // Start the simulation with the Golden Demo's config
    startSimulation(simulationConfig); // Pass the config to startSimulation
    addLog(`Launching simulation for Golden Demo: "${demo.name}"`, 'info');
  };

  // State and handlers for filtering GoldenDemos
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
                      <div key={demo.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
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
                                  onClick={() => handleLaunch(demo)}
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
    </div>
  );
};
