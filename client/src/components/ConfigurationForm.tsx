import React from 'react';

export const ConfigurationForm: React.FC = () => {
  return (
    <div className="p-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Organization & Credentials</h2>
        <div className="space-y-4">
          {/* Inputs will be bound to Zustand store later */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">PagerDuty Subdomain</label>
             <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" placeholder="subdomain" />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">REST API Token</label>
             <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" placeholder="y_..." />
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Simulation Settings</h2>
        <div className="space-y-4">
           <p className="text-sm text-gray-500">Rate, probabilities, and timing configurations will go here.</p>
        </div>
      </div>
    </div>
  );
};
