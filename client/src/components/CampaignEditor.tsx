import React, { useEffect, useState } from 'react';
import { useStore, ImportedCampaign, CampaignItem } from '../store/useStore';
import { Trash2, Save, ChevronDown, ChevronUp, Braces, Code } from 'lucide-react';

interface CampaignEditorProps {
  campaignId: string | 'new';
  initialData?: Partial<ImportedCampaign>;
  onClose: () => void;
}

export const CampaignEditor: React.FC<CampaignEditorProps> = ({ campaignId, initialData, onClose }) => {
  const { importedCampaigns, addLog, createCampaign, updateCampaign, deleteCampaign } = useStore();
  const [campaign, setCampaign] = useState<ImportedCampaign | null>(null);
  const [isNew, setIsNew] = useState(campaignId === 'new');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (campaignId === 'new') {
      setIsNew(true);
      setCampaign({
        id: 'new',
        name: 'New Campaign',
        description: '',
        source: 'User Created',
        integrationKey: '',
        items: [],
        ...initialData, // Override with initial data if provided
      });
    } else {
      setIsNew(false);
      const existingCampaign = importedCampaigns.find(c => c.id === campaignId);
      if (existingCampaign) {
        setCampaign(existingCampaign);
      } else {
        addLog(`Campaign with ID ${campaignId} not found.`, 'error');
        onClose();
      }
    }
  }, [campaignId, importedCampaigns, addLog, onClose]);

  const toggleStep = (id: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSteps(newExpanded);
  };

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!campaign || !draggingId || draggingId === targetId) return;
    const items = [...campaign.items];
    const fromIdx = items.findIndex(i => i.id === draggingId);
    const toIdx = items.findIndex(i => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    setCampaign({ ...campaign, items });
    setDraggingId(null);
  };

  const handleSave = async () => {
    if (!campaign) return;
    setIsLoading(true);
    try {
      const { id, source, ...dataToSave } = campaign;
      if (isNew) {
        await createCampaign(dataToSave);
      } else {
        await updateCampaign(campaign.id, dataToSave);
      }
      onClose();
    } catch (error: any) {
      addLog(`Error saving campaign: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!campaign || isNew) return;
    if (!window.confirm(`Are you sure you want to delete campaign "${campaign.name}"?`)) return;

    setIsLoading(true);
    try {
      await deleteCampaign(campaign.id);
      onClose();
    } catch (error: any) {
      addLog(`Error deleting campaign: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrettify = (index: number) => {
    if (!campaign) return;
    const newItems = [...campaign.items];
    try {
      const parsed = JSON.parse(newItems[index].payloadString);
      newItems[index].payloadString = JSON.stringify(parsed, null, 2);
      setCampaign({ ...campaign, items: newItems });
    } catch (e) {
      addLog("Invalid JSON: Cannot prettify", "error");
    }
  };

  if (!campaign) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h2>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Create New Campaign' : `Edit Campaign: ${campaign.name}`}
        </h2>
        <div className="flex gap-2">
             {!isNew && (
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-2 rounded-md font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-2 rounded-md font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors text-sm"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-2 rounded-md font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors text-sm"
            >
              Close
            </button>
        </div>
      </div>

      {/* Campaign Details Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <input
              id="campaignName"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={campaign.name}
              onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="campaignDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="campaignDescription"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={campaign.description}
              onChange={(e) => setCampaign({ ...campaign, description: e.target.value })}
            />
          </div>
          
          {/* Webhook Configuration */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Webhook Configuration (Optional)</h4>
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label htmlFor="campaignIntegrationKey" className="block text-xs font-medium text-gray-500 mb-1">Default Incident Routing Key</label>
                    <input
                      id="campaignIntegrationKey"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="Override for all incident steps"
                      value={campaign.integrationKey || ''}
                      onChange={(e) => setCampaign({ ...campaign, integrationKey: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Stored securely. Webhooks can trigger this campaign without additional headers.
                    </p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Items (Steps) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Campaign Steps ({campaign.items.length})</h3>
          <button
            onClick={() => {
              const newItem: CampaignItem = {
                id: crypto.randomUUID(),
                stepName: '',
                payloadString: '{}',
                eventAction: 'trigger',
                eventType: 'incident',
                dedupKey: null,
                integrationKey: '',
                delaySeconds: 0,
                times: 1,
                intervalSeconds: 0,
              };
              setCampaign({ ...campaign, items: [...campaign.items, newItem] });
              // Auto-expand the new item
              setExpandedSteps(new Set(expandedSteps).add(newItem.id));
            }}
            className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors"
          >
            + Add Step
          </button>
        </div>

        <div className="space-y-3">
            {campaign.items.map((item, index) => {
                const isExpanded = expandedSteps.has(item.id);
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header */}
                    <div 
                        className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleStep(item.id)}
                        draggable
                        onDragStart={() => handleDragStart(item.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(item.id)}
                    >
                        <div className="flex items-center gap-3">
                            <button className="text-gray-500">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <span className="font-semibold text-gray-700">Step {index + 1}</span>
                            <span className="text-sm text-gray-600 border-l border-gray-300 pl-3">
                                {item.stepName || <span className="italic text-gray-400">Unnamed Step</span>}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.eventType === 'change' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                {item.eventType === 'change' ? 'Change Event' : 'Incident'}
                            </span>
                             <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                Delay: {item.delaySeconds}s
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                             <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(window.confirm('Remove this step?')) {
                                         setCampaign({
                                            ...campaign,
                                            items: campaign.items.filter((_, i) => i !== index),
                                          });
                                    }
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                        </div>
                    </div>

                    {/* Body */}
                    {isExpanded && (
                        <div className="p-4 bg-white border-t border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Step Name</label>
                                    <input
                                      type="text"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      placeholder="e.g., Database Latency Spike"
                                      value={item.stepName || ''}
                                      onChange={(e) => {
                                        const newItems = [...campaign.items];
                                        newItems[index] = { ...newItems[index], stepName: e.target.value };
                                        setCampaign({ ...campaign, items: newItems });
                                      }}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Event Type</label>
                                    <select
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      value={item.eventType}
                                      onChange={(e) => {
                                        const newItems = [...campaign.items];
                                        newItems[index] = { ...newItems[index], eventType: e.target.value as 'incident' | 'change' };
                                        setCampaign({ ...campaign, items: newItems });
                                      }}
                                    >
                                      <option value="incident">Incident</option>
                                      <option value="change">Change</option>
                                    </select>
                                </div>
                                 <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Delay (sec)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      value={item.delaySeconds}
                                      onChange={(e) => {
                                        const newItems = [...campaign.items];
                                        newItems[index] = { ...newItems[index], delaySeconds: Number(e.target.value) };
                                        setCampaign({ ...campaign, items: newItems });
                                      }}
                                    />
                                </div>
                                 <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Repeats</label>
                                    <input
                                      type="number"
                                      min="1"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      value={item.times}
                                      onChange={(e) => {
                                        const newItems = [...campaign.items];
                                        newItems[index] = { ...newItems[index], times: Number(e.target.value) };
                                        setCampaign({ ...campaign, items: newItems });
                                      }}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Interval (sec)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      value={item.intervalSeconds}
                                      onChange={(e) => {
                                        const newItems = [...campaign.items];
                                        newItems[index] = { ...newItems[index], intervalSeconds: Number(e.target.value) };
                                        setCampaign({ ...campaign, items: newItems });
                                      }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Event Action</label>
                                    <input
                                      type="text"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      value={item.eventAction}
                                      onChange={(e) => {
                                        const newItems = [...campaign.items];
                                        newItems[index] = { ...newItems[index], eventAction: e.target.value };
                                        setCampaign({ ...campaign, items: newItems });
                                      }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Dedup Key (Optional)</label>
                                    <input
                                      type="text"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                                      value={item.dedupKey || ''}
                                      placeholder="Leave empty for auto-generated"
                                      onChange={(e) => {
                                        const newItems = [...campaign.items];
                                        newItems[index] = { ...newItems[index], dedupKey: e.target.value || null };
                                        setCampaign({ ...campaign, items: newItems });
                                      }}
                                    />
                                </div>
                            </div>

                            {item.eventType === 'change' && (
                                <div className="mb-4 p-3 bg-purple-50 rounded-md border border-purple-100">
                                    <label className="block text-xs font-medium text-purple-800 mb-1">Integration Key (Routing Key) for Change Event</label>
                                    <input
                                        type="text"
                                        className="w-full px-2 py-1.5 border border-purple-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="Override global routing key (Optional)"
                                        value={item.integrationKey || ''}
                                        onChange={(e) => {
                                            const newItems = [...campaign.items];
                                            newItems[index] = { ...newItems[index], integrationKey: e.target.value };
                                            setCampaign({ ...campaign, items: newItems });
                                        }}
                                    />
                                    <p className="text-xs text-purple-600 mt-1">If left blank, the campaign's default change routing key will be used.</p>
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-medium text-gray-500">Payload JSON</label>
                                    <button 
                                        onClick={() => handlePrettify(index)}
                                        className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                                    >
                                        <Braces className="w-3 h-3" /> Prettify JSON
                                    </button>
                                </div>
                                <textarea
                                  rows={8}
                                  className="w-full p-3 border border-gray-300 rounded-md text-sm font-mono bg-slate-50"
                                  value={item.payloadString}
                                  onChange={(e) => {
                                    const newItems = [...campaign.items];
                                    newItems[index] = { ...newItems[index], payloadString: e.target.value };
                                    setCampaign({ ...campaign, items: newItems });
                                  }}
                                ></textarea>
                            </div>
                        </div>
                    )}
                  </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};
