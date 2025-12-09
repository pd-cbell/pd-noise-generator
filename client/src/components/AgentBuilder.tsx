import React, { useState } from 'react';
import { Sparkles, Bot, Loader2, CheckCircle, RefreshCcw } from 'lucide-react';
import { api } from '../services/api';
import { useStore, ImportedCampaign } from '../store/useStore';

interface AgentBuilderProps {
  onBuildComplete: (campaign: any) => void;
}

export const AgentBuilder: React.FC<AgentBuilderProps> = ({ onBuildComplete }) => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'proposing' | 'proposed' | 'building'>('idle');
  const [proposal, setProposal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('google');

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
    try {
      const campaignData = await api.agentBuild(prompt, provider, proposal);
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
            times: item.times || 1, // Default to 1 if not present
        })) || []
      };
      
      onBuildComplete(newCampaign);
    } catch (e: any) {
      setError(e.message || "Failed to build campaign");
      setStatus('proposed'); // Go back to proposed state
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-full mb-4">
            <Bot className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Agentic Campaign Builder</h1>
        <p className="text-gray-600 max-w-lg mx-auto">
          Describe a failure scenario in plain English. The AI Agent will design the chaos for you.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Step 1: Input */}
        <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                    What scenario do you want to simulate?
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
                className="w-full p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
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
                        Analyze Scenario
                    </button>
                </div>
            )}
        </div>

        {/* Error Display */}
        {error && (
            <div className="p-4 bg-red-100 text-red-700 border-b border-red-200">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
            </div>
        )}

        {/* Loading States */}
        {(status === 'proposing' || status === 'building') && (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                <p className="font-medium text-lg">
                    {status === 'proposing' ? 'Analyzing your request...' : 'Constructing failure events...'}
                </p>
            </div>
        )}

        {/* Step 2: Proposal Review */}
        {status === 'proposed' && (
            <div className="p-6 bg-indigo-50">
                <div className="flex items-start gap-4">
                    <div className="mt-1">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Proposed Plan</h3>
                        <div className="prose text-gray-700 whitespace-pre-wrap">
                            {proposal}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={() => setStatus('idle')}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Refine Request
                    </button>
                    <button
                        onClick={handleBuild}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Bot className="w-5 h-5" />
                        Approve & Build
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
