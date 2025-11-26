import React, { useEffect, useMemo } from 'react';
import { useStore, Service } from '../store/useStore';
import { Loader2, Terminal, Copy, Check } from 'lucide-react';

export const CampaignManager: React.FC<{ onEditCampaign: (campaignId: string | 'new') => void }> = ({ onEditCampaign }) => {
  const {
    campaignConfig, setCampaignConfig,
    payloadAdapters, loadPayloadAdapters,
    importedCampaigns, loadImportedCampaigns,
    triggerImportedCampaign, addLog,
    services, // From ConfigurationState
    apiToken, globalRoutingKey
  } = useStore();

  // Load payload adapters and imported campaigns on mount
  useEffect(() => {
    loadPayloadAdapters();
    loadImportedCampaigns();
  }, [loadPayloadAdapters, loadImportedCampaigns]);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyCurl = (id: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Calculate change coverage stats
  const changeCoverage = useMemo(() => {
    const includedServices = services.filter((svc: Service) => svc.include);
    const includedWithChange = includedServices.filter((svc: Service) => Array.isArray(svc.changeIntegrations) && svc.changeIntegrations.length > 0).length;
    const totalWithChange = services.filter((svc: Service) => Array.isArray(svc.changeIntegrations) && svc.changeIntegrations.length > 0).length;
    
    return {
      included: includedServices.length,
      includedWithChange,
      totalWithChange,
    };
  }, [services]);

  const hasChangeCoverage = changeCoverage.totalWithChange > 0;

  const handleTemplateSelection = (adapterId: string, checked: boolean) => {
    let newTemplateIds = campaignConfig.templateIds || [];
    if (checked) {
      newTemplateIds = [...new Set([...newTemplateIds, adapterId])];
    } else {
      newTemplateIds = newTemplateIds.filter(id => id !== adapterId);
    }
    setCampaignConfig({ templateIds: newTemplateIds, templateMode: 'custom' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Failure Campaigns</h2>

      {/* Campaign Configuration */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center">
            <input
              id="campaignEnabled"
              type="checkbox"
              className="form-checkbox h-4 w-4 text-green-600 rounded"
              checked={campaignConfig.enabled}
              onChange={(e) => setCampaignConfig({ enabled: e.target.checked })}
            />
            <label htmlFor="campaignEnabled" className="ml-2 text-sm font-medium text-gray-700">Enable Failure Campaigns</label>
          </div>
          <div>
            <label htmlFor="campaignProbability" className="block text-sm font-medium text-gray-700 mb-1">Probability (0-1)</label>
            <input
              id="campaignProbability"
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={campaignConfig.probability}
              onChange={(e) => setCampaignConfig({ probability: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label htmlFor="campaignWindow" className="block text-sm font-medium text-gray-700 mb-1">Window (seconds)</label>
            <input
              id="campaignWindow"
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={campaignConfig.windowSec}
              onChange={(e) => setCampaignConfig({ windowSec: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div>
            <label htmlFor="campaignMaxRelated" className="block text-sm font-medium text-gray-700 mb-1">Max Related Services</label>
            <input
              id="campaignMaxRelated"
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={campaignConfig.maxRelated}
              onChange={(e) => setCampaignConfig({ maxRelated: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="importedChangeRoutingKey" className="block text-sm font-medium text-gray-700 mb-1">Imported Change Routing Key (for manual bundles)</label>
            <input
              id="importedChangeRoutingKey"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={campaignConfig.importedChangeRoutingKey}
              onChange={(e) => setCampaignConfig({ importedChangeRoutingKey: e.target.value })}
            />
            {hasChangeCoverage && (
              <p className="mt-1 text-xs text-gray-500">
                Change event coverage for selected services: {changeCoverage.includedWithChange} / {changeCoverage.included}
              </p>
            )}
            {!hasChangeCoverage && (
              <p className="mt-1 text-xs text-yellow-600">
                No change event integrations found on selected services. Change events will not be emitted.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Payload Template Selection */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Payload Template Selection</h3>
        <div className="flex items-center gap-4 mb-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio h-4 w-4 text-green-600"
              name="templateMode"
              value="all"
              checked={campaignConfig.templateMode === 'all'}
              onChange={() => setCampaignConfig({ templateMode: 'all' })}
            />
            <span className="ml-2 text-sm text-gray-700">All Adapters</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio h-4 w-4 text-green-600"
              name="templateMode"
              value="custom"
              checked={campaignConfig.templateMode === 'custom'}
              onChange={() => setCampaignConfig({ templateMode: 'custom' })}
            />
            <span className="ml-2 text-sm text-gray-700">Select templates manually</span>
          </label>
        </div>

        {campaignConfig.templateMode === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2 border-t pt-4 mt-4">
            {payloadAdapters.filter(adapter => adapter.supportsCampaigns).map(adapter => (
              <label key={adapter.id} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-green-600 rounded"
                  checked={campaignConfig.templateIds.includes(adapter.id)}
                  onChange={(e) => handleTemplateSelection(adapter.id, e.target.checked)}
                />
                <span className="ml-2 text-sm text-gray-700">{adapter.label} ({adapter.vendor || 'Built-in'})</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Imported Campaigns */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Imported Campaign Bundles ({importedCampaigns.length})</h3>
          <button
            onClick={() => onEditCampaign('new')}
            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
          >
            Create New Campaign
          </button>
        </div>
        {importedCampaigns.length === 0 ? (
          <p className="text-gray-500">No imported campaigns found in /templates folder.</p>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {importedCampaigns.map((campaign) => {
              // Construct curl command dynamically
              const host = window.location.origin;
              let curlCmd = "";
              
              if (campaign.integrationKey) {
                  curlCmd = `curl -X POST ${host}/api/campaigns/${campaign.id}/trigger`;
              } else {
                  curlCmd = `curl -X POST ${host}/api/campaigns/${campaign.id}/trigger \
  -H "x-pd-routing-key: ${globalRoutingKey || '$PD_ROUTING_KEY'}" \
  -H "x-pd-change-routing-key: ${campaignConfig.importedChangeRoutingKey || '$PD_CHANGE_ROUTING_KEY'}"`;
              }

              return (
                <div key={campaign.id} className="flex flex-col bg-gray-50 p-4 rounded-md border border-gray-200 gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{campaign.name}</p>
                      <p className="text-xs text-gray-600">{campaign.description} (from {campaign.source})</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEditCampaign(campaign.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => triggerImportedCampaign(campaign)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors"
                      >
                        Trigger Now
                      </button>
                    </div>
                  </div>
                  
                  {/* Webhook Section */}
                  <div className="bg-gray-900 rounded p-3 relative group">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                            <Terminal className="w-3 h-3" />
                            Webhook Trigger
                        </div>
                         <button
                            onClick={() => handleCopyCurl(campaign.id, curlCmd)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Copy to clipboard"
                        >
                            {copiedId === campaign.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                    <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {curlCmd}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payload Registry Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Payload Registry ({payloadAdapters.length})</h3>
        <div className="max-h-60 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supports Campaigns</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payloadAdapters.map((adapter) => (
                <tr key={adapter.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{adapter.label}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{adapter.group === 'observability' ? 'Built-in' : 'Custom'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{adapter.supportsCampaigns ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};