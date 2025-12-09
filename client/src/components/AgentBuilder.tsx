import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, Loader2, CheckCircle, RefreshCcw, Server, Settings } from 'lucide-react';
import { api } from '../services/api';
import { useStore, Service } from '../store/useStore';
import { ServiceSelector } from './ServiceSelector';

interface AgentBuilderProps {
  onBuildComplete: (campaign: any) => void;
}

export const AgentBuilder: React.FC<AgentBuilderProps> = ({ onBuildComplete }) => {
  const { services, fetchServices, selectedTeamIds } = useStore();
  
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'proposing' | 'proposed' | 'building'>('idle');
  const [proposal, setProposal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('google');

  // New High-Control State
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [eventCount, setEventCount] = useState<number>(10);
  const [changeCount, setChangeCount] = useState<number>(2);

  // Load services if not loaded
  useEffect(() => {
      if (services.length === 0 && selectedTeamIds.length > 0) {
          fetchServices();
      }
  }, [selectedTeamIds]);

  // Pre-select all visible services when proposal starts, or let user pick
  useEffect(() => {
      if (status === 'proposed' && selectedServiceIds.length === 0) {
          setSelectedServiceIds(services.filter(s => s.include).map(s => s.id));
      }
  }, [status, services]);

  const handleAnalyze = async () => {
    if (!prompt.trim()) return;
    setStatus('proposing');
    setError(null);
    try {
      const res = await api.agentProposal(prompt, provider);
      setProposal(res.summary);
      setStatus('proposed');
    } catch (e: any) {
      setError(e.message || "Failed to generate proposal");
      setStatus('idle');
    }
  };

  const handleBuild = async () => {
    setStatus('building');
    setError(null);
    
    // Filter full service objects to send to backend
    const targetServices = services.filter(s => selectedServiceIds.includes(s.id));

    if (targetServices.length === 0) {
        setError("Please select at least one service.");
        setStatus('proposed');
        return;
    }

    try {
      const campaignData = await api.agentBuild({
          prompt, 
          provider, 
          approvedPlan: proposal,
          services: targetServices,
          eventCount,
          changeCount
      });

      // Map API response to ImportedCampaign structure
      // API returns: { name, description, items: [] } where items have 'payload' object
      // ImportedCampaign needs: { id, source, items: [{ payloadString: "..." }] }
      const newCampaign = {
        id: 'new', // Editor will handle ID generation
        source: `AI Agent (${provider})`,
        ...campaignData,
        items: campaignData.items?.map((item: any) => ({
            ...item,
            payloadString: JSON.stringify(item.payload || {}, null, 2),
            times: item.repeatCount || 1, 
        })) || []
      };
      
      onBuildComplete(newCampaign);
    } catch (e: any) {
      setError(e.message || "Failed to build campaign");
      setStatus('proposed');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-full mb-4">
            <Bot className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Agentic Campaign Builder</h1>
        <p className="text-gray-600 max-w-lg mx-auto">
          Describe a failure scenario. The AI will design a "Golden Demo" campaign for you.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Step 1: Input */}
        <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                    Scenario Request
                </label>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">AI Model:</span>
                    <select 
                        value={provider} 
                        onChange={(e) => setProvider(e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500"
                        disabled={status !== 'idle'}
                    >
                        <option value="google">Gemini 2.5 Pro</option>
                        <option value="openai">GPT-5.1</option>
                    </select>
                </div>
            </div>
            <textarea
                className="w-full p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                placeholder="e.g., A slow memory leak in the Search API causing 504 errors, followed by a full crash during a deployment."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={status !== 'idle' && status !== 'proposed'}
            />
            
            {status === 'idle' && (
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleAnalyze}
                        disabled={!prompt.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles className="w-5 h-5" />
                        Analyze & Plan
                    </button>
                </div>
            )}
        </div>

        {/* Error Display */}
        {error && (
            <div className="p-4 bg-red-100 text-red-700 border-b border-red-200 text-sm">
                <p className="font-bold">Error:</p>
                <p>{error}</p>
            </div>
        )}

        {/* Loading States */}
        {(status === 'proposing' || status === 'building') && (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                <p className="font-medium text-lg">
                    {status === 'proposing' ? 'Analyzing your request...' : 'Constructing campaign artifacts...'}
                </p>
            </div>
        )}

        {/* Step 2: Proposal Review (High Control) */}
        {status === 'proposed' && (
            <div className="flex flex-col md:flex-row h-full min-h-[400px]">
                {/* Left: Narrative Editor */}
                <div className="md:w-1/2 p-6 bg-gray-50 border-r border-gray-200 flex flex-col">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Demo Narrative (Editable)
                    </h3>
                    <textarea 
                        value={proposal}
                        onChange={(e) => setProposal(e.target.value)}
                        className="flex-1 w-full p-3 border border-gray-300 rounded-md text-sm text-gray-800 font-mono leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Right: Configuration */}
                <div className="md:w-1/2 p-6 bg-white flex flex-col gap-6">
                    
                    {/* Service Selection */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        <ServiceSelector 
                            services={services}
                            selectedIds={selectedServiceIds}
                            onChange={setSelectedServiceIds}
                        />
                    </div>

                    {/* Volume Control */}
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                            <Settings className="w-4 h-4 text-gray-600" />
                            Volume Constraints
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Alerts</label>
                                <input 
                                    type="number" 
                                    min="1" max="50"
                                    value={eventCount}
                                    onChange={(e) => setEventCount(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded p-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Change Events</label>
                                <input 
                                    type="number" 
                                    min="0" max="10"
                                    value={changeCount}
                                    onChange={(e) => setChangeCount(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded p-2 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            onClick={() => setStatus('idle')}
                            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleBuild}
                            disabled={selectedServiceIds.length === 0}
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Bot className="w-5 h-5" />
                            Approve & Build
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};