import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Play, Sparkles, Server, RefreshCw } from 'lucide-react';

export const DirectorDashboard: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    try {
      await api.generateTemplates(topic, count);
      showToast(`Generated ${count} templates for "${topic}"`, 'success');
      await loadTemplates();
      setTopic('');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTrigger = async (templateId: string) => {
    try {
      const res = await api.triggerTemplate(templateId);
      showToast(`Triggered: ${res.summary}`, 'success');
    } catch (e: any) {
      showToast(e.message || "Failed to trigger", 'error');
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900">AI Scenario Factory</h2>
        </div>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Scenario Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Kubernetes Cluster Failure, Redis Latency, Payment Gateway Timeout"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic}
            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[42px]"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-600" />
            Director Soundboard
          </h2>
          <button onClick={loadTemplates} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            Refresh List
          </button>
        </div>

        {isLoading ? (
           <div className="text-center py-12 text-gray-500">Loading templates...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                    {template.topic}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-medium text-gray-900 mb-1 line-clamp-2 h-12">
                  {template.payload.summary}
                </h3>
                <div className="text-xs text-gray-500 mb-4 space-y-1">
                  <p>Source: {template.payload.source}</p>
                  <p>Comp: {template.payload.component}</p>
                </div>
                
                <button
                  onClick={() => handleTrigger(template.id)}
                  className="w-full py-2 bg-gray-100 hover:bg-green-600 hover:text-white text-gray-700 font-medium rounded flex items-center justify-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Trigger Event
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
