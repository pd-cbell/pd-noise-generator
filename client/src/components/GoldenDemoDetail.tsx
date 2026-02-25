import React, { useState } from 'react';
import { GoldenDemo } from '../store/useStore';
import { Play, History, Download, Star } from 'lucide-react';
import { SessionHistory } from './SessionHistory';
import { useStore } from '../store/useStore';
import { useAuth, UserRole } from '../contexts/AuthContext';

interface GoldenDemoDetailProps {
  demo: GoldenDemo;
  onLaunch: (demo: GoldenDemo) => void;
  onEdit?: (demoId: string) => void; // Optional edit handler
}

const GoldenDemoDetail: React.FC<GoldenDemoDetailProps> = ({ demo, onLaunch, onEdit }) => {
  const { user } = useAuth();
  const { updateGoldenDemo, addLog } = useStore();
  const fullNarrative = demo.configJson?.narrative?.full || '';
  const showFullNarrative =
    Boolean(fullNarrative && fullNarrative.trim()) &&
    fullNarrative.trim() !== demo.narrative.trim();
  const [isFullNarrativeOpen, setIsFullNarrativeOpen] = useState(false);
  const [isUpdatingStar, setIsUpdatingStar] = useState(false);
  const isAdmin = user?.role === UserRole.ADMIN;

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      goldenDemo: demo,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${demo.name || 'golden-demo'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleStar = async () => {
    if (!isAdmin || isUpdatingStar) return;
    setIsUpdatingStar(true);
    try {
      await updateGoldenDemo(demo.id, { isStarred: !demo.isStarred });
      addLog(`${!demo.isStarred ? 'Starred' : 'Unstarred'} Golden Demo "${demo.name}"`, 'info');
    } finally {
      setIsUpdatingStar(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-4 border-b pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-900">{demo.name}</h2>
          {demo.isStarred && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
              Approved / Tested
            </span>
          )}
          {demo.isShared && (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
              Shared
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(demo.id)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Edit Details
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => void handleToggleStar()}
              disabled={isUpdatingStar}
              className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                demo.isStarred
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              <Star size={18} className={demo.isStarred ? 'fill-amber-400 text-amber-500' : ''} />
              {demo.isStarred ? 'Unstar' : 'Star as Approved'}
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            Export JSON
          </button>
          <button
            onClick={() => onLaunch(demo)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Play size={20} /> Launch Simulation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm font-medium text-gray-500">Vertical</p>
          <p className="text-lg text-gray-900">{demo.vertical}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Maturity Level</p>
          <p className="text-lg text-gray-900">{demo.maturityLevel}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Narrative</h3>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap">{demo.narrative}</p>
        </div>
      </div>

      {showFullNarrative && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setIsFullNarrativeOpen((prev) => !prev)}
            className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"
          >
            Narrative (Generation Source)
            <span className="text-gray-400">{isFullNarrativeOpen ? 'Hide' : 'Show'}</span>
          </button>
          {isFullNarrativeOpen && (
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{fullNarrative}</p>
            </div>
          )}
        </div>
      )}

      {demo.personaNotes && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Persona Notes</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{demo.personaNotes}</p>
        </div>
      )}

      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-500" />
            Session History
        </h3>
        <SessionHistory goldenDemoId={demo.id} />
      </div>

      <div className="mt-auto border-t pt-4 text-sm text-gray-500 flex justify-between">
        <p>Created: {new Date(demo.createdAt).toLocaleString()}</p>
        <p>Last Updated: {new Date(demo.updatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
};

export default GoldenDemoDetail;
