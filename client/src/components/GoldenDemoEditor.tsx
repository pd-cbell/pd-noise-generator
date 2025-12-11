import React, { useState } from 'react';
import { GoldenDemo } from '../../../server/src/types';
import { useStore } from '../store/useStore';
import { X, Save } from 'lucide-react';

interface GoldenDemoEditorProps {
  demo: GoldenDemo;
  onClose: () => void;
}

export const GoldenDemoEditor: React.FC<GoldenDemoEditorProps> = ({ demo, onClose }) => {
  const { updateGoldenDemo } = useStore();
  const [formData, setFormData] = useState({
    name: demo.name,
    vertical: demo.vertical,
    maturityLevel: demo.maturityLevel,
    narrative: demo.narrative,
    personaNotes: demo.personaNotes || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateGoldenDemo(demo.id, formData);
      onClose();
    } catch (error) {
      console.error("Failed to update demo", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h3 className="font-bold text-gray-900">Edit Golden Demo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vertical</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.vertical}
                onChange={e => setFormData({...formData, vertical: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Maturity Level</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.maturityLevel}
                onChange={e => setFormData({...formData, maturityLevel: e.target.value})}
              >
                <option value="Reactive">Reactive</option>
                <option value="Proactive">Proactive</option>
                <option value="Preventative">Preventative</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Narrative</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none min-h-[150px]"
              value={formData.narrative}
              onChange={e => setFormData({...formData, narrative: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Persona Notes</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
              value={formData.personaNotes}
              onChange={e => setFormData({...formData, personaNotes: e.target.value})}
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-xl gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};
