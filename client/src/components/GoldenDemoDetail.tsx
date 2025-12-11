import React from 'react';
import { GoldenDemo } from '../../../server/src/types';
import { Play, History } from 'lucide-react';
import { SessionHistory } from './SessionHistory';

interface GoldenDemoDetailProps {
  demo: GoldenDemo;
  onLaunch: (demo: GoldenDemo) => void;
  onEdit?: (demoId: string) => void; // Optional edit handler
}

const GoldenDemoDetail: React.FC<GoldenDemoDetailProps> = ({ demo, onLaunch, onEdit }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-4 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">{demo.name}</h2>
        <div className="flex space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(demo.id)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Edit Details
            </button>
          )}
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
