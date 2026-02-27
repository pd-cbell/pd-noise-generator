import React, { useState, useMemo } from 'react';
import { GoldenDemo, MappingProfile, useStore } from '../store/useStore';
import { hasGoldenDemoTaxonomy } from '../constants/goldenDemoTaxonomy';
import { resolveServicePreview, EventType, SimulatorConfig } from '../utils/mappingLogic';
import { Play, CheckCircle, XCircle, Info, Zap, Layers, AlertTriangle, Edit2, Save, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../services/api';

interface GoldenDemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  demo: GoldenDemo | null;
  selectedMappingProfile: MappingProfile | null;
  onLaunch: (demo: GoldenDemo, profileId?: string) => void;
}

export const GoldenDemoDetailModal: React.FC<GoldenDemoDetailModalProps> = ({
  isOpen,
  onClose,
  demo,
  selectedMappingProfile,
  onLaunch,
}) => {
  if (!isOpen || !demo) return null;

  const { mappingProfiles, services, fetchMappingProfiles, addLog } = useStore();
  const [localProfileId, setLocalProfileId] = useState<string>(selectedMappingProfile?.id || '');
  
  // Inline Editing State
  const [editingLogicalService, setEditingLogicalService] = useState<string | null>(null);
  const [selectedRealServiceId, setSelectedRealServiceId] = useState<string>('');
  const [serviceQueryByLogical, setServiceQueryByLogical] = useState<Record<string, string>>({});
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  // Find the profile object based on local selection
  const effectiveProfile = useMemo(() => 
    mappingProfiles.find(p => p.id === localProfileId) || null, 
  [mappingProfiles, localProfileId]);

  // Extract unique logical services and their event types
  const logicalServices = useMemo(() => {
    const s: { name: string; types: Set<EventType> }[] = [];
    demo.configJson.items.forEach((item: any) => {
      const logicalServiceName = item.logicalServiceName || item.service || item.serviceName || item?.payload?.custom_details?.service_name || 'Unknown Service';
      const eventType: EventType = item.eventType || item.type || 'alert';

      let existingService = s.find(ls => ls.name === logicalServiceName);
      if (!existingService) {
        existingService = { name: logicalServiceName, types: new Set() };
        s.push(existingService);
      }
      existingService.types.add(eventType);
    });
    return s.sort((a, b) => a.name.localeCompare(b.name));
  }, [demo]);

  const handleLaunchClick = () => {
    onLaunch(demo, localProfileId || undefined);
    onClose();
  };

  const handleStartEdit = (logicalName: string, currentRealServiceId?: string) => {
    setEditingLogicalService(logicalName);
    setSelectedRealServiceId(currentRealServiceId || '');
    const currentName = services.find(s => s.id === currentRealServiceId)?.name || '';
    setServiceQueryByLogical(prev => ({ ...prev, [logicalName]: currentName }));
  };

  const handleCancelEdit = () => {
    setEditingLogicalService(null);
    setSelectedRealServiceId('');
  };

  const handleServiceQueryChange = (logicalName: string, value: string) => {
    setServiceQueryByLogical(prev => ({ ...prev, [logicalName]: value }));
    const match = services.find(s => s.name === value);
    setSelectedRealServiceId(match?.id || '');
  };

  const handleSaveMapping = async (logicalName: string) => {
    if (!effectiveProfile) return;
    setIsSavingMapping(true);
    try {
      const realService = services.find(s => s.id === selectedRealServiceId);
      const changeIntegrationKey =
        realService?.changeIntegrations?.find((integration) => integration?.integrationKey)?.integrationKey ||
        null;
      const mappingPayload = [{
        logicalServiceName: logicalName,
        incidentServiceId: realService?.id || null,
        incidentServiceName: realService?.name || null,
        changeServiceId: realService?.id || null,
        changeServiceName: realService?.name || null,
        changeRoutingKeyOverride: changeIntegrationKey || null,
        useIncidentForChange: false,
      }];

      await api.addMappingsToProfile(effectiveProfile.id, mappingPayload);
      await fetchMappingProfiles(); // Refresh to update preview
      if (!changeIntegrationKey) {
        addLog(`Updated mapping for ${logicalName} (change events remain unmapped: no change routing key found).`, 'warn');
      } else {
        addLog(`Updated mapping for ${logicalName}`, 'info');
      }
      setEditingLogicalService(null);
    } catch (e: any) {
      addLog(`Failed to update mapping: ${e.message}`, 'error');
    } finally {
      setIsSavingMapping(false);
    }
  };

  const simulatorConfig: SimulatorConfig = {
    pdChangeEventsRoutingKey: useStore.getState().globalRoutingKey,
  };
  const fullNarrative = demo.configJson?.narrative?.full || '';
  const generationDiagnostics = demo.configJson?.generationDiagnostics;
  const showFullNarrative =
    Boolean(fullNarrative && fullNarrative.trim()) &&
    fullNarrative.trim() !== demo.narrative.trim();
  const [isFullNarrativeOpen, setIsFullNarrativeOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{demo.name}</h2>
              <p className="text-sm text-gray-600">
                {demo.industry && demo.useCase ? (
                  <>
                    <span className="font-medium">{demo.industry}</span> &middot;{' '}
                    <span className="font-medium">{demo.useCase}</span>
                  </>
                ) : (
                  <span className="font-medium text-amber-700">Needs taxonomy update</span>
                )}
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
          {!hasGoldenDemoTaxonomy(demo) && (
            <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-lg p-3 text-sm">
              This demo is using legacy taxonomy. Edit it to set approved Industry + Use Case values before reusing broadly.
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Narrative</h3>
            <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <ReactMarkdown>{demo.narrative || 'No narrative provided.'}</ReactMarkdown>
            </div>
          </div>
          {showFullNarrative && (
            <div>
              <button
                type="button"
                onClick={() => setIsFullNarrativeOpen((prev) => !prev)}
                className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"
              >
                Narrative (Generation Source)
                <span className="text-gray-400">{isFullNarrativeOpen ? 'Hide' : 'Show'}</span>
              </button>
              {isFullNarrativeOpen && (
                <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <ReactMarkdown>{fullNarrative}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {generationDiagnostics && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Generation Diagnostics</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-700">
                <div><span className="text-gray-500">Provider:</span> {generationDiagnostics.provider || 'unknown'}</div>
                <div><span className="text-gray-500">Model:</span> {generationDiagnostics.model || 'unknown'}</div>
                <div><span className="text-gray-500">Prompt Version:</span> {generationDiagnostics.promptVersion || 'n/a'}</div>
                <div><span className="text-gray-500">Generated:</span> {generationDiagnostics.generatedAt ? new Date(generationDiagnostics.generatedAt).toLocaleString() : 'n/a'}</div>
                <div><span className="text-gray-500">Events:</span> {generationDiagnostics.eventCount ?? 0}</div>
                <div><span className="text-gray-500">Changes:</span> {generationDiagnostics.changeCount ?? 0}</div>
                <div><span className="text-gray-500">Beats:</span> {generationDiagnostics.beatsCount ?? 0}</div>
                <div><span className="text-gray-500">Sparse Details:</span> {generationDiagnostics.sparseCustomDetailsCount ?? 0}</div>
              </div>
            </div>
          )}

          {/* Mapping Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-800">Mapping Preview</h3>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Profile:</label>
                    <select 
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={localProfileId}
                        onChange={(e) => {
                            setLocalProfileId(e.target.value);
                            setEditingLogicalService(null); // Cancel edit on profile change
                        }}
                    >
                        <option value="">No Profile (Logical Names)</option>
                        {mappingProfiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {effectiveProfile ? (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-700 mb-4">
                  Viewing mappings with profile:{' '}
                  <span className="font-semibold">{effectiveProfile.name}</span>
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
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logicalServices.map((ls, idx) => {
                      const typesArray = Array.from(ls.types);
                      const firstResult = resolveServicePreview(
                          { logicalServiceName: ls.name, type: 'incident' }, // Use 'incident' to check general mapping presence
                          effectiveProfile, 
                          simulatorConfig
                        );
                      
                      const isEditing = editingLogicalService === ls.name;

                      return typesArray.map((type, typeIdx) => {
                        const result = resolveServicePreview(
                          { logicalServiceName: ls.name, type }, 
                          effectiveProfile, 
                          simulatorConfig
                        );

                        return (
                          <tr key={`${ls.name}-${typeIdx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {typeIdx === 0 && ( 
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
                              {isEditing && typeIdx === 0 ? (
                                <div>
                                  <input
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    list={`service-options-${ls.name}`}
                                    placeholder="Type to search services..."
                                    value={serviceQueryByLogical[ls.name] || ''}
                                    onChange={(e) => handleServiceQueryChange(ls.name, e.target.value)}
                                  />
                                  <datalist id={`service-options-${ls.name}`}>
                                    <option value="">-- Unmapped --</option>
                                    {services.map(s => (
                                      <option key={s.id} value={s.name} />
                                    ))}
                                  </datalist>
                                </div>
                              ) : (
                                result.effectiveServiceName || 'N/A'
                              )}
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
                            {typeIdx === 0 && (
                                <td rowSpan={typesArray.length} className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    {isEditing ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handleSaveMapping(ls.name)}
                                                disabled={isSavingMapping}
                                                className="text-green-600 hover:text-green-900"
                                            >
                                                {isSavingMapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            </button>
                                            <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleStartEdit(ls.name, firstResult.effectiveServiceId)}
                                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 ml-auto"
                                        >
                                            <Edit2 className="w-3 h-3" /> Map
                                        </button>
                                    )}
                                </td>
                            )}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">{effectiveProfile.description}</p>
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
