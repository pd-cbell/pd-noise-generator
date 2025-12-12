import React from 'react';
import { GoldenDemo, MappingProfile, useStore } from '../store/useStore';
import { resolveServicePreview, LogicalEventTarget, EventType, SimulatorConfig } from '../utils/mappingLogic';
import { Play, AlertTriangle, CheckCircle, XCircle, Info, Zap, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // For rendering narrative

interface GoldenDemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  demo: GoldenDemo | null;
  selectedMappingProfile: MappingProfile | null;
  onLaunch: (demo: GoldenDemo) => void;
}

export const GoldenDemoDetailModal: React.FC<GoldenDemoDetailModalProps> = ({
  isOpen,
  onClose,
  demo,
  selectedMappingProfile,
  onLaunch,
}) => {
  if (!isOpen || !demo) return null;

  const { addLog } = useStore();

  // Extract unique logical services and their event types
  const logicalServices: { name: string; types: Set<EventType> }[] = [];
  demo.configJson.items.forEach((item: any) => {
    const logicalServiceName = item.logicalServiceName || item.service || item.serviceName || item?.payload?.custom_details?.service_name || 'Unknown Service';
    const eventType: EventType = item.eventType || item.type || 'alert';

    let existingService = logicalServices.find(ls => ls.name === logicalServiceName);
    if (!existingService) {
      existingService = { name: logicalServiceName, types: new Set() };
      logicalServices.push(existingService);
    }
    existingService.types.add(eventType);
  });

  // Sort services for consistent display
  logicalServices.sort((a, b) => a.name.localeCompare(b.name));

  const handleLaunchClick = () => {
    onLaunch(demo);
    onClose(); // Close modal after launching
  };

  const simulatorConfig: SimulatorConfig = {
    pdChangeEventsRoutingKey: useStore.getState().globalRoutingKey, // Use global routing key from store for change events if not explicitly mapped
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{demo.name}</h2>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{demo.vertical}</span> &middot;{' '}
                <span className="font-medium">{demo.maturityLevel}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XCircle size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Narrative */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Narrative</h3>
            <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <ReactMarkdown>{demo.narrative || 'No narrative provided.'}</ReactMarkdown>
            </div>
          </div>

          {/* Mapping Preview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Mapping Preview</h3>
            {selectedMappingProfile ? (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-700 mb-4">
                  Viewing mappings with profile:{' '}
                  <span className="font-semibold">{selectedMappingProfile.name}</span>
                </p>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Logical Service
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mapped Service
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logicalServices.map((ls, idx) => {
                      const typesArray = Array.from(ls.types);
                      
                      return typesArray.map((type, typeIdx) => {
                        const result = resolveServicePreview(
                          { logicalServiceName: ls.name, type }, 
                          selectedMappingProfile, 
                          simulatorConfig
                        );

                        return (
                          <tr key={`${ls.name}-${typeIdx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {typeIdx === 0 && ( // Only render logical service name once if multiple event types
                              <td rowSpan={typesArray.length} className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {ls.name}
                                </td>
                            )}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  result.effectiveRoutingKey || result.effectiveChangeRoutingKey ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                  {type === 'change' ? <Zap className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                                  {type}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {result.effectiveServiceName || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {result.isMapped && result.hasRoutingKey ? (
                                <span className="inline-flex items-center text-green-600 font-medium">
                                  <CheckCircle className="w-4 h-4 mr-1" /> Mapped
                                </span>
                              ) : result.isMapped && !result.hasRoutingKey ? (
                                <span className="inline-flex items-center text-orange-500 font-medium">
                                  <AlertTriangle className="w-4 h-4 mr-1" /> Missing Key
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-red-600 font-medium">
                                  <XCircle className="w-4 h-4 mr-1" /> Unmapped
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">{selectedMappingProfile.description}</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Info className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      No mapping profile selected. Logical services will be used directly without transformation.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300"
          >
            Close
          </button>
          <button
            onClick={handleLaunchClick}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-md transition-colors bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" /> Launch Demo
          </button>
        </div>
      </div>
    </div>
  );
};
