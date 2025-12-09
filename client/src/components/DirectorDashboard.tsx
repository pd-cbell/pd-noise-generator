import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Play, Terminal, Box, Layers, Server, AlertTriangle, Zap, CheckCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PayloadTemplate {
  id: string;
  name: string;
  description: string | null;
  isDraft: boolean;
}

interface Service {
  id: string;
  name: string;
  templates: PayloadTemplate[];
}

interface Team {
  id: string;
  name: string;
  persona: string | null;
  services: Service[];
}

interface Domain {
  id: string;
  name: string;
  teams: Team[];
}

export const DirectorDashboard: React.FC = () => {
  const { addLog } = useStore();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // Preview Modal State
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    loadTaxonomy();
  }, []);

  const loadTaxonomy = async () => {
    try {
      const data = await api.getTaxonomyTree();
      setDomains(data);
      if (data.length > 0) {
        setSelectedDomainId(data[0].id);
        if (data[0].teams.length > 0) {
            setSelectedTeamId(data[0].teams[0].id);
        }
      }
    } catch (e: any) {
      addLog(`Failed to load taxonomy: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrigger = async (templateId: string, templateName: string) => {
    setTriggeringId(templateId);
    try {
      await api.triggerTemplate(templateId);
      addLog(`Director: Triggered '${templateName}'`, 'info');
    } catch (e: any) {
      addLog(`Failed to trigger '${templateName}': ${e.message}`, 'error');
    } finally {
      setTriggeringId(null);
    }
  };

  const handlePreview = async (templateId: string) => {
      try {
          const data = await api.previewTemplate(templateId);
          setPreviewData(data);
          setIsPreviewOpen(true);
      } catch (e: any) {
          addLog(`Failed to preview: ${e.message}`, 'error');
      }
  };

  const activeDomain = domains.find(d => d.id === selectedDomainId);
  const activeTeam = activeDomain?.teams.find(t => t.id === selectedTeamId);

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Header & Filters */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
                <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900">Director Soundboard</h1>
                <p className="text-xs text-gray-500">Live Incident Injection</p>
            </div>
        </div>

        <div className="flex gap-4">
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Domain</label>
                <select
                    className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    value={selectedDomainId}
                    onChange={(e) => {
                        setSelectedDomainId(e.target.value);
                        const domain = domains.find(d => d.id === e.target.value);
                        if (domain && domain.teams.length > 0) setSelectedTeamId(domain.teams[0].id);
                        else setSelectedTeamId('');
                    }}
                >
                    {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Team</label>
                <select
                    className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    disabled={!activeDomain}
                >
                    {activeDomain?.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* Main Grid */}
      {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Loading taxonomy...</div>
      ) : !activeTeam ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              No team selected or configured.
          </div>
      ) : (
          <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {activeTeam.services.map(service => (
                      <div key={service.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                          {/* Service Header */}
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                              <Server className="w-4 h-4 text-gray-400" />
                              <h3 className="font-bold text-gray-800 truncate" title={service.name}>{service.name}</h3>
                          </div>
                          
                          {/* Templates List */}
                          <div className="p-3 space-y-2 flex-1">
                              {service.templates.length === 0 ? (
                                  <div className="text-center py-4 text-xs text-gray-400 italic">No templates</div>
                              ) : (
                                  service.templates.map(tpl => (
                                      <div key={tpl.id} className="group relative bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                                          <div className="flex justify-between items-start mb-2">
                                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tpl.isDraft ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                  {tpl.isDraft ? 'Draft' : 'Ready'}
                                              </span>
                                              <button 
                                                onClick={() => handlePreview(tpl.id)}
                                                className="text-gray-400 hover:text-indigo-600 p-1"
                                                title="Test Fire (Dry Run)"
                                              >
                                                  <Terminal className="w-3 h-3" />
                                              </button>
                                          </div>
                                          <h4 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">{tpl.name}</h4>
                                          <p className="text-[10px] text-gray-500 mb-3 line-clamp-2 h-8">{tpl.description || 'No description'}</p>
                                          
                                          <button
                                              onClick={() => handleTrigger(tpl.id, tpl.name)}
                                              disabled={triggeringId === tpl.id}
                                              className={`w-full py-2 rounded flex items-center justify-center gap-2 text-sm font-semibold transition-colors
                                                  ${triggeringId === tpl.id 
                                                      ? 'bg-gray-100 text-gray-400 cursor-wait' 
                                                      : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 hover:border-red-600'
                                                  }`}
                                          >
                                              {triggeringId === tpl.id ? (
                                                  <span className="animate-spin">⌛</span>
                                              ) : (
                                                  <Zap className="w-4 h-4 fill-current" />
                                              )}
                                              {triggeringId === tpl.id ? 'Firing...' : 'Inject Fault'}
                                          </button>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  ))}
                  
                  {/* Add New Service Card Placeholder */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 p-6 min-h-[200px]">
                      <Box className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm font-medium">Add Service via Config</span>
                  </div>
              </div>
          </div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <Terminal className="w-5 h-5 text-indigo-600" />
                          Payload Preview (Faker Rendered)
                      </h3>
                      <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-0 flex-1 overflow-auto bg-slate-900">
                      <pre className="p-4 text-xs font-mono text-green-400">
                          {JSON.stringify(previewData, null, 2)}
                      </pre>
                  </div>
                  <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-xl">
                      <button 
                        onClick={() => setIsPreviewOpen(false)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
