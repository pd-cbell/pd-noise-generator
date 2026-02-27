import React, { useEffect, useRef, useState } from 'react';
import { useStore, GoldenDemo } from '../store/useStore';
import { Loader2, Plus, Edit, Trash2, Upload, Star } from 'lucide-react';
import GoldenDemoDetail from './GoldenDemoDetail';
import { GoldenDemoEditorV2 } from './GoldenDemoEditorV2';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { getGoldenDemoQualityVerdict, hasGoldenDemoTaxonomy } from '../constants/goldenDemoTaxonomy';

const GoldenDemoLibrary: React.FC = () => {
  const { 
    goldenDemos, 
    isLoadingGoldenDemos, 
    fetchGoldenDemos,
    deleteGoldenDemo,
    addLog,
    pendingEditGoldenDemoId,
    clearEditGoldenDemoRequest,
    updateGoldenDemo,
  } = useStore();
  
  const { user } = useAuth();
  const canEditAll = user?.role === UserRole.EDITOR || user?.role === UserRole.ADMIN;
  const isAdmin = user?.role === UserRole.ADMIN;
  const canCreate = Boolean(user);

  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false); // Edit Modal State
  const [draftDemo, setDraftDemo] = useState<GoldenDemo | null>(null);
  const selectedDemo = goldenDemos.find(demo => demo.id === selectedDemoId);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchGoldenDemos();
  }, [fetchGoldenDemos]);

  useEffect(() => {
    if (!pendingEditGoldenDemoId) return;

    const requestedDemo = goldenDemos.find((demo) => demo.id === pendingEditGoldenDemoId);
    if (!requestedDemo) {
      if (!isLoadingGoldenDemos) {
        fetchGoldenDemos();
      }
      return;
    }

    setSelectedDemoId(requestedDemo.id);
    const canEditRequested =
      canEditAll || requestedDemo.createdByUserId === user?.id;
    if (canEditRequested) {
      setDraftDemo(requestedDemo);
      setIsEditing(true);
    }
    clearEditGoldenDemoRequest();
  }, [
    pendingEditGoldenDemoId,
    goldenDemos,
    isLoadingGoldenDemos,
    fetchGoldenDemos,
    canEditAll,
    user?.id,
    clearEditGoldenDemoRequest,
  ]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteGoldenDemo(id);
        if (selectedDemoId === id) {
          setSelectedDemoId(null);
        }
      } catch (error) {
        // Error already logged by useStore
      }
    }
  };

  const handleLaunchSimulation = (demo: GoldenDemo) => {
    // Library launch is currently a lightweight preview/log action; Director handles live track injection.
    addLog(`Launching simulation for Golden Demo: "${demo.name}"`, 'info');
    // For now, just log the config
    console.log('Simulation Config:', demo.configJson);
  };

  const handleToggleStar = async (demo: GoldenDemo) => {
    if (!isAdmin) return;
    try {
      await updateGoldenDemo(demo.id, { isStarred: !demo.isStarred });
      addLog(`${!demo.isStarred ? 'Starred' : 'Unstarred'} Golden Demo "${demo.name}"`, 'info');
    } catch {
      // error already logged by store
    }
  };

  const buildUniqueName = (baseName: string) => {
    const existingNames = new Set(goldenDemos.map((d) => d.name));
    if (!existingNames.has(baseName)) return baseName;
    let counter = 2;
    let candidate = `${baseName} (Imported)`;
    if (!existingNames.has(candidate)) return candidate;
    while (existingNames.has(`${candidate} ${counter}`)) {
      counter += 1;
    }
    return `${candidate} ${counter}`;
  };

  const parseImportedDemo = (raw: any): Omit<GoldenDemo, 'id' | 'createdAt' | 'updatedAt' | 'createdByUserId'> => {
    const payload = raw?.goldenDemo || raw;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid import format: expected Golden Demo JSON.');
    }
    if (!payload.name || !payload.narrative || !payload.configJson) {
      throw new Error('Missing required Golden Demo fields (name, narrative, configJson).');
    }
    return {
      name: String(payload.name),
      vertical: payload.vertical ? String(payload.vertical) : undefined,
      maturityLevel: payload.maturityLevel ? String(payload.maturityLevel) : undefined,
      industry: payload.industry ? String(payload.industry) : undefined,
      useCase: payload.useCase ? String(payload.useCase) : undefined,
      narrative: String(payload.narrative),
      configJson: payload.configJson,
      personaNotes: payload.personaNotes || '',
      isShared: Boolean(payload.isShared),
    };
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parseImportedDemo(parsed);
      const uniqueName = buildUniqueName(imported.name);
      const created = await useStore.getState().createGoldenDemo({
        ...imported,
        name: uniqueName,
      });
      setSelectedDemoId(created.id);
      addLog(`Imported Golden Demo "${created.name}"`, 'info');
    } catch (error: any) {
      setImportError(error.message || 'Failed to import Golden Demo.');
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar - Golden Demo List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Golden Demos</h2>
          {canCreate && (
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImportFile(file);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button
                className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                title="Import Golden Demo"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={18} />
              </button>
              <button 
                className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
                title="Create New Golden Demo"
                onClick={() => {
                  const blank: GoldenDemo = {
                    id: 'new',
                    name: '',
                    vertical: '',
                    maturityLevel: '',
                    industry: '',
                    useCase: '',
                    narrative: '',
                    configJson: { name: '', description: '', items: [], narrative: { stages: {}, full: '' } } as any,
                    personaNotes: '',
                    isShared: false,
                    createdByUserId: '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  };
                  setDraftDemo(blank);
                  setIsEditing(true);
                }}
              >
                <Plus size={20} />
              </button>
            </div>
          )}
        </div>
        {importError && (
          <div className="px-4 py-2 text-xs text-red-600 border-b border-red-100 bg-red-50">
            {importError}
          </div>
        )}
        <div className="flex-grow overflow-y-auto">
          {isLoadingGoldenDemos ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="animate-spin inline-block mr-2" size={20} /> Loading Demos...
            </div>
          ) : goldenDemos.length === 0 ? (
            <p className="p-4 text-gray-500">No Golden Demos found. {canCreate ? 'Create one!' : ''}</p>
          ) : (
            <ul>
              {goldenDemos.map((demo) => {
                const quality = getGoldenDemoQualityVerdict(demo);
                const qualityLabel =
                  quality.status === 'pass' ? 'PASS' : quality.status === 'warn' ? 'WARN' : 'Unscored';
                const qualityClass =
                  quality.status === 'pass'
                    ? 'bg-emerald-100 text-emerald-800'
                    : quality.status === 'warn'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-700';
                return (
                <li 
                  key={demo.id} 
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 ${selectedDemoId === demo.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                  onClick={() => setSelectedDemoId(demo.id)}
                >
                  <div>
                    <p className="font-medium text-gray-800 flex items-center gap-1">
                      {demo.name}
                      {demo.isStarred && <Star size={12} className="text-amber-500 fill-amber-400" />}
                    </p>
                    <p className="text-sm text-gray-500">
                      {demo.industry && demo.useCase ? `${demo.industry} - ${demo.useCase}` : (demo.vertical || 'Legacy demo taxonomy')}
                    </p>
                    <p
                      className={`mt-1 inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${qualityClass}`}
                      title={quality.issues.join(' • ')}
                    >
                      Quality {qualityLabel}
                    </p>
                    {!hasGoldenDemoTaxonomy(demo) && (
                      <p className="text-xs text-amber-700 mt-1">Needs taxonomy update</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {(canEditAll || demo.createdByUserId === user?.id) && (
                      <>
                        {isAdmin && (
                          <button
                            className={`${demo.isStarred ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-amber-500'}`}
                            title={demo.isStarred ? 'Unstar approved demo' : 'Star as approved/tested demo'}
                            onClick={(e) => { e.stopPropagation(); void handleToggleStar(demo); }}
                          >
                            <Star size={16} className={demo.isStarred ? 'fill-amber-400' : ''} />
                          </button>
                        )}
                        <button 
                          className="text-gray-500 hover:text-blue-600" 
                          title="Edit"
                          onClick={(e) => { e.stopPropagation(); setSelectedDemoId(demo.id); setDraftDemo(demo); setIsEditing(true); }} 
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="text-gray-500 hover:text-red-600" 
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(demo.id, demo.name); }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Main Content - Golden Demo Detail */}
      <div className="flex-grow p-6 overflow-y-auto">
        {selectedDemo ? (
          <GoldenDemoDetail 
            demo={selectedDemo} 
            onLaunch={() => handleLaunchSimulation(selectedDemo)} 
            onEdit={(canEditAll || selectedDemo.createdByUserId === user?.id) ? () => { setDraftDemo(selectedDemo); setIsEditing(true); } : undefined} 
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-lg">
            Select a Golden Demo {canCreate ? 'or create a new one' : ''} to view details.
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isEditing && (draftDemo || selectedDemo) && (
        <GoldenDemoEditorV2 
          demo={(draftDemo || selectedDemo)!} 
          onClose={() => { setIsEditing(false); setDraftDemo(null); }}
          isNew={draftDemo?.id === 'new'}
        />
      )}
    </div>
  );
};

export default GoldenDemoLibrary;
