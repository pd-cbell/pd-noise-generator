import React, { useEffect, useState } from 'react';
import { useStore, ImportedCampaign } from '../store/useStore';

interface CampaignEditorProps {
  campaignId: string | 'new';
  onClose: () => void;
}

export const CampaignEditor: React.FC<CampaignEditorProps> = ({ campaignId, onClose }) => {
  const { importedCampaigns, addLog } = useStore();
  const [campaign, setCampaign] = useState<ImportedCampaign | null>(null);
  const [isNew, setIsNew] = useState(campaignId === 'new');

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

      {/* Campaign Items (Steps) - Placeholder */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Campaign Steps ({campaign.items.length})</h3>
        <p className="text-gray-500">Editor for campaign steps coming soon...</p>
      </div>


      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          Close
        </button>
        {/* Save/Delete buttons will go here later */}
      </div>
    </div>
  );
};
