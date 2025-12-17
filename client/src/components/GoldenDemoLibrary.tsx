import React, { useEffect, useState } from 'react';
import { useStore, GoldenDemo } from '../store/useStore';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import GoldenDemoDetail from './GoldenDemoDetail';
import { GoldenDemoEditorV2 } from './GoldenDemoEditorV2';
import { useAuth, UserRole } from '../contexts/AuthContext';

const GoldenDemoLibrary: React.FC = () => {
  const { 
    goldenDemos, 
    isLoadingGoldenDemos, 
    fetchGoldenDemos,
    deleteGoldenDemo,
    addLog,
    pendingEditGoldenDemoId,
    clearEditGoldenDemoRequest,
  } = useStore();
  
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.EDITOR || user?.role === UserRole.ADMIN;

  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false); // Edit Modal State
  const [draftDemo, setDraftDemo] = useState<GoldenDemo | null>(null);
  const selectedDemo = goldenDemos.find(demo => demo.id === selectedDemoId);

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
    if (canEdit) {
      setDraftDemo(requestedDemo);
      setIsEditing(true);
    }
    clearEditGoldenDemoRequest();
  }, [
    pendingEditGoldenDemoId,
    goldenDemos,
    isLoadingGoldenDemos,
    fetchGoldenDemos,
    canEdit,
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
    // TODO: Implement actual simulation launch logic based on demo.configJson
    addLog(`Launching simulation for Golden Demo: "${demo.name}"`, 'info');
    // For now, just log the config
    console.log('Simulation Config:', demo.configJson);
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar - Golden Demo List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Golden Demos</h2>
          {canEdit && (
            <button 
              className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              title="Create New Golden Demo"
              onClick={() => {
                const blank: GoldenDemo = {
                  id: 'new',
                  name: '',
                  vertical: '',
                  maturityLevel: '',
                  narrative: '',
                  configJson: { name: '', description: '', items: [], narrative: { stages: {} } } as any,
                  personaNotes: '',
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
          )}
        </div>
        <div className="flex-grow overflow-y-auto">
          {isLoadingGoldenDemos ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="animate-spin inline-block mr-2" size={20} /> Loading Demos...
            </div>
          ) : goldenDemos.length === 0 ? (
            <p className="p-4 text-gray-500">No Golden Demos found. {canEdit ? 'Create one!' : ''}</p>
          ) : (
            <ul>
              {goldenDemos.map((demo) => (
                <li 
                  key={demo.id} 
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 ${selectedDemoId === demo.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                  onClick={() => setSelectedDemoId(demo.id)}
                >
                  <div>
                    <p className="font-medium text-gray-800">{demo.name}</p>
                    <p className="text-sm text-gray-500">{demo.vertical} - {demo.maturityLevel}</p>
                  </div>
                  <div className="flex space-x-2">
                    {canEdit && (
                      <>
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
              ))}
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
            onEdit={canEdit ? () => { setDraftDemo(selectedDemo); setIsEditing(true); } : undefined} 
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-lg">
            Select a Golden Demo {canEdit ? 'or create a new one' : ''} to view details.
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
