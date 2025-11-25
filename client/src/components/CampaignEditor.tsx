import React, { useEffect, useState } from 'react';
import { useStore, ImportedCampaign, CampaignItem } from '../store/useStore';
import { Trash2, Save } from 'lucide-react'; // Icons

interface CampaignEditorProps {
  campaignId: string | 'new';
  onClose: () => void;
}

export const CampaignEditor: React.FC<CampaignEditorProps> = ({ campaignId, onClose }) => {
  const { importedCampaigns, addLog, createCampaign, updateCampaign, deleteCampaign } = useStore();
  const [campaign, setCampaign] = useState<ImportedCampaign | null>(null);
  const [isNew, setIsNew] = useState(campaignId === 'new');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (campaignId === 'new') {
      setIsNew(true);
      setCampaign({
        id: 'new', // Placeholder ID
        name: 'New Campaign',
        description: '',
        source: 'User Created',
        items: [],
      });
    } else {
      setIsNew(false);
      const existingCampaign = importedCampaigns.find(c => c.id === campaignId);
      if (existingCampaign) {
        setCampaign(existingCampaign);
      } else {
        addLog(`Campaign with ID ${campaignId} not found.`, 'error');
        onClose(); // Close editor if campaign not found
      }
    }
  }, [campaignId, importedCampaigns, addLog, onClose]);

  const handleSave = async () => {
    if (!campaign) return;
    setIsLoading(true);
    try {
      if (isNew) {
        // Exclude 'id' and 'source' for creation
        const { id, source, ...dataToSave } = campaign;
        await createCampaign(dataToSave);
      } else {
        // Exclude 'id' and 'source' for update
        const { id, source, ...dataToSave } = campaign;
        await updateCampaign(campaign.id, dataToSave);
      }
      onClose(); // Close editor after successful save
    } catch (error: any) {
      addLog(`Error saving campaign: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!campaign || isNew) return; // Cannot delete unsaved campaign
    if (!window.confirm(`Are you sure you want to delete campaign "${campaign.name}"?`)) return;

    setIsLoading(true);
    try {
      await deleteCampaign(campaign.id);
      onClose(); // Close editor after successful delete
    } catch (error: any) {
      addLog(`Error deleting campaign: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };


  if (!campaign) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Campaign...</h2>
        <p className="text-gray-600">Please wait.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {isNew ? 'Create New Campaign' : `Edit Campaign: ${campaign.name}`}
      </h2>

      {/* Campaign Details Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="space-y-4">
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
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={campaign.description}
              onChange={(e) => setCampaign({ ...campaign, description: e.target.value })}
            />
          </div>
          {/* Source is read-only for now */}
          <div>
            <label htmlFor="campaignSource" className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <input
              id="campaignSource"
              type="text"
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              value={campaign.source}
            />
          </div>
        </div>
      </div>

      {/* Campaign Items (Steps) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Campaign Steps ({campaign.items.length})</h3>
          <button
            onClick={() => {
              // Add a new, empty campaign item
              const newItem: CampaignItem = {
                id: crypto.randomUUID(), // Client-side ID for new item
                payloadString: '{}',
                eventAction: 'trigger',
                eventType: 'incident',
                dedupKey: null,
                delaySeconds: 0,
                times: 1,
                intervalSeconds: 0,
              };
              setCampaign({ ...campaign, items: [...campaign.items, newItem] });
            }}
            className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors"
          >
            Add Step
          </button>
        </div>

        {campaign.items.length === 0 ? (
          <p className="text-gray-500">No steps defined for this campaign. Click "Add Step" to add one.</p>
        ) : (
          <div className="space-y-4">
            {campaign.items.map((item, index) => (
              <div key={item.id} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-gray-800">Step {index + 1}</h4>
                  <button
                    onClick={() => {
                      setCampaign({
                        ...campaign,
                        items: campaign.items.filter((_, i) => i !== index),
                      });
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label htmlFor={`delaySeconds-${item.id}`} className="block text-xs font-medium text-gray-500">Delay (sec)</label>
                    <input
                      id={`delaySeconds-${item.id}`}
                      type="number"
                      min="0"
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      value={item.delaySeconds}
                      onChange={(e) => {
                        const newItems = [...campaign.items];
                        newItems[index] = { ...newItems[index], delaySeconds: Number(e.target.value) };
                        setCampaign({ ...campaign, items: newItems });
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor={`eventType-${item.id}`} className="block text-xs font-medium text-gray-500">Event Type</label>
                    <select
                      id={`eventType-${item.id}`}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
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
                  <div>
                    <label htmlFor={`eventAction-${item.id}`} className="block text-xs font-medium text-gray-500">Event Action</label>
                    <input
                      id={`eventAction-${item.id}`}
                      type="text"
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      value={item.eventAction}
                      onChange={(e) => {
                        const newItems = [...campaign.items];
                        newItems[index] = { ...newItems[index], eventAction: e.target.value };
                        setCampaign({ ...campaign, items: newItems });
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor={`dedupKey-${item.id}`} className="block text-xs font-medium text-gray-500">Dedup Key (Optional)</label>
                    <input
                      id={`dedupKey-${item.id}`}
                      type="text"
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      value={item.dedupKey || ''}
                      onChange={(e) => {
                        const newItems = [...campaign.items];
                        newItems[index] = { ...newItems[index], dedupKey: e.target.value || null };
                        setCampaign({ ...campaign, items: newItems });
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor={`times-${item.id}`} className="block text-xs font-medium text-gray-500">Repeat Times</label>
                    <input
                      id={`times-${item.id}`}
                      type="number"
                      min="1"
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      value={item.times}
                      onChange={(e) => {
                        const newItems = [...campaign.items];
                        newItems[index] = { ...newItems[index], times: Number(e.target.value) };
                        setCampaign({ ...campaign, items: newItems });
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor={`intervalSeconds-${item.id}`} className="block text-xs font-medium text-gray-500">Interval (sec)</label>
                    <input
                      id={`intervalSeconds-${item.id}`}
                      type="number"
                      min="0"
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                      value={item.intervalSeconds}
                      onChange={(e) => {
                        const newItems = [...campaign.items];
                        newItems[index] = { ...newItems[index], intervalSeconds: Number(e.target.value) };
                        setCampaign({ ...campaign, items: newItems });
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={`payloadString-${item.id}`} className="block text-xs font-medium text-gray-500 mb-1">Payload JSON</label>
                  <textarea
                    id={`payloadString-${item.id}`}
                    rows={8}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm font-mono"
                    value={item.payloadString}
                    onChange={(e) => {
                      const newItems = [...campaign.items];
                      newItems[index] = { ...newItems[index], payloadString: e.target.value };
                      setCampaign({ ...campaign, items: newItems });
                    }}
                  ></textarea>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-md font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center gap-1 px-4 py-2 rounded-md font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 rounded-md font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
