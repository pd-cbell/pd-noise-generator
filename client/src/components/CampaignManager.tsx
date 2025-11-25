import React from 'react';

export const CampaignManager: React.FC = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Failure Campaigns</h2>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
        <p className="text-gray-500 mb-4">Manage coordinated failure scenarios and imported payloads.</p>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
           Import Campaign Bundle
        </button>
      </div>
    </div>
  );
};
