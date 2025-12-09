import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Server, Users, Search, Eye, EyeOff } from 'lucide-react';
import { Service } from '../store/useStore';

interface ServiceSelectorProps {
  services: Service[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({ services, selectedIds, onChange }) => {
  const [filterText, setFilterText] = useState('');
  const [showDemoSlices, setShowDemoSlices] = useState(false); // Default: Hide NOC/SRE teams

  // Group services by team name with filtering
  const groupedServices = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    groups['Unassigned'] = [];

    services.forEach(svc => {
      // 1. Filter by Name (Search)
      if (filterText && !svc.name.toLowerCase().includes(filterText.toLowerCase())) {
          return; // Skip if search text doesn't match service name
      }

      // 2. Filter by Demo Slice (if toggle OFF)
      // Check if ANY of the service's teams are hidden "Demo Slices"
      // Wait, filtering logic should be per TEAM usually, but here we iterate services.
      // Let's iterate teams attached to the service.
      
      const visibleTeams = (svc.teams || []).filter(team => {
          if (showDemoSlices) return true; // Show all
          return !team.name.startsWith("NOC - ") && !team.name.startsWith("SRE - ");
      });

      if (visibleTeams.length > 0) {
        visibleTeams.forEach(team => {
            if (!groups[team.name]) groups[team.name] = [];
            if (!groups[team.name].find(s => s.id === svc.id)) {
                groups[team.name].push(svc);
            }
        });
      } else if (svc.teams.length === 0) {
         // Only add unassigned if we are not strict about demo slices or if needed
         groups['Unassigned'].push(svc);
      }
    });

    // Cleanup empty Unassigned
    if (groups['Unassigned'].length === 0) delete groups['Unassigned'];
    
    // Sort keys alphabetically
    return Object.keys(groups).sort().reduce(
      (obj, key) => { 
        obj[key] = groups[key]; 
        return obj;
      }, 
      {} as Record<string, Service[]>
    );
  }, [services, filterText, showDemoSlices]);

  // Collapsed state for groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Selection Logic
  const handleSelectAll = () => {
    // Select only currently visible services
    const visibleIds = Object.values(groupedServices).flat().map(s => s.id);
    // If all visible are selected, deselect them. Otherwise select all visible.
    const allVisibleSelected = visibleIds.every(id => selectedIds.includes(id));
    
    if (allVisibleSelected) {
        onChange(selectedIds.filter(id => !visibleIds.includes(id)));
    } else {
        const newIds = Array.from(new Set([...selectedIds, ...visibleIds]));
        onChange(newIds);
    }
  };

  const handleTeamToggle = (groupName: string, groupServices: Service[]) => {
    const groupIds = groupServices.map(s => s.id);
    const allSelected = groupIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      onChange(selectedIds.filter(id => !groupIds.includes(id)));
    } else {
      const newIds = Array.from(new Set([...selectedIds, ...groupIds]));
      onChange(newIds);
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    if (selectedIds.includes(serviceId)) {
      onChange(selectedIds.filter(id => id !== serviceId));
    } else {
      onChange([...selectedIds, serviceId]);
    }
  };

  const visibleServiceCount = Object.values(groupedServices).flat().length;
  const allSelected = visibleServiceCount > 0 && Object.values(groupedServices).flat().every(s => selectedIds.includes(s.id));

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-md bg-white overflow-hidden">
      {/* Search & Filter Header */}
      <div className="p-2 border-b border-gray-200 space-y-2 bg-white">
          <div className="relative">
              <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
              <input 
                  type="text"
                  placeholder="Filter actors..."
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
              />
          </div>
          <div className="flex items-center justify-between">
              <button
                  onClick={() => setShowDemoSlices(!showDemoSlices)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors ${
                      showDemoSlices ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                  title="Show hidden admin teams (NOC/SRE)"
              >
                  {showDemoSlices ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {showDemoSlices ? 'Hide Demo Slices' : 'Show Demo Slices'}
              </button>
              <button
                  onClick={handleSelectAll}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                  {allSelected ? 'Unselect All' : 'Select All Visible'}
              </button>
          </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-50">
        {Object.entries(groupedServices).map(([groupName, groupServices]) => {
          const groupIds = groupServices.map(s => s.id);
          const isAllGroupSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id));
          const isSomeGroupSelected = !isAllGroupSelected && groupIds.some(id => selectedIds.includes(id));
          const isCollapsed = collapsedGroups[groupName];

          // Demo Slice Styling
          const isDemoSlice = groupName.startsWith("NOC - ") || groupName.startsWith("SRE - ");
          const headerBg = isDemoSlice ? 'bg-purple-50' : 'bg-white';

          return (
            <div key={groupName} className={`border ${isDemoSlice ? 'border-purple-100' : 'border-gray-200'} rounded-md overflow-hidden shadow-sm`}>
              {/* Group Header */}
              <div className={`flex items-center ${headerBg} px-2 py-1.5 hover:brightness-95 transition-colors select-none`}>
                <button 
                    onClick={() => toggleGroupCollapse(groupName)}
                    className="p-1 mr-1 text-gray-400 hover:text-gray-600"
                >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                
                {/* Team Checkbox */}
                <input
                  type="checkbox"
                  checked={isAllGroupSelected}
                  ref={input => { if (input) input.indeterminate = isSomeGroupSelected; }}
                  onChange={() => handleTeamToggle(groupName, groupServices)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 mr-2 cursor-pointer"
                />
                
                <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => toggleGroupCollapse(groupName)}
                >
                    <Users className={`w-3 h-3 ${isDemoSlice ? 'text-purple-500' : 'text-gray-500'}`} />
                    <span className={`text-sm font-semibold ${isDemoSlice ? 'text-purple-800' : 'text-gray-700'}`}>{groupName}</span>
                    <span className="text-xs text-gray-400 font-medium ml-auto">{groupServices.length}</span>
                </div>
              </div>

              {/* Group Items */}
              {!isCollapsed && (
                <div className="pl-8 pr-2 py-1 space-y-0.5 bg-white border-t border-gray-100">
                  {groupServices.map(svc => (
                    <label key={svc.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(svc.id)}
                        onChange={() => handleServiceToggle(svc.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-gray-300 group-hover:border-indigo-400 transition-colors"
                      />
                      <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{svc.name}</p>
                          {svc.changeIntegrationKey && <p className="text-[10px] text-green-600 leading-none">Change Enabled</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {visibleServiceCount === 0 && (
            <div className="p-4 text-center text-gray-400 text-xs italic">
                {filterText ? 'No matching actors found.' : 'No available actors.'}
            </div>
        )}
      </div>
    </div>
  );
};