import React, { useState, useEffect } from 'react';
import { useStore, MappingProfile, Service } from '../store/useStore';
import { X, Plus, Save, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface AddToProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedServices: Service[];
}

export const AddToProfileModal: React.FC<AddToProfileModalProps> = ({ isOpen, onClose, selectedServices }) => {
  const { mappingProfiles, fetchMappingProfiles, createMappingProfile, updateMappingProfile, addLog } = useStore();
  
  const [targetProfileId, setTargetProfileId] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMappingProfiles();
      setTargetProfileId('');
      setNewProfileName('');
      setIsCreatingNew(false);
    }
  }, [isOpen, fetchMappingProfiles]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      let profileId = targetProfileId;

      // 1. Create Profile if needed
      if (isCreatingNew) {
        if (!newProfileName.trim()) {
          addLog('Please enter a name for the new profile.', 'warn');
          setIsSubmitting(false);
          return;
        }
        const newProfile = await createMappingProfile({ name: newProfileName, serviceMappings: [] });
        profileId = newProfile.id;
      } else {
        if (!profileId) {
          addLog('Please select a target profile.', 'warn');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Generate Mappings
      const mappings = selectedServices.map(svc => ({
        logicalServiceName: svc.name, // Default: Logical Name = Real Name
        incidentServiceName: svc.name, // Default: Map to same service
        incidentServiceId: svc.id,
        // We could add intelligent transforms here later
      }));

      // 3. Add to Profile
      await api.addMappingsToProfile(profileId, mappings);
      
      addLog(`Added ${mappings.length} mappings to profile.`, 'info');
      
      // Refresh profiles to show updated counts etc if needed
      await fetchMappingProfiles();
      onClose();

    } catch (e: any) {
      addLog(`Failed to add mappings: ${e.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Add Services to Mapping Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Adding <strong>{selectedServices.length}</strong> selected services to a mapping profile.
            This will create default mappings where <em>Logical Name = Real Service Name</em>.
          </p>

          {!isCreatingNew ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Profile</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                value={targetProfileId}
                onChange={(e) => setTargetProfileId(e.target.value)}
              >
                <option value="">-- Choose a Profile --</option>
                {mappingProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.serviceMappings?.length || 0} mappings)</option>
                ))}
              </select>
              <button 
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mt-1"
                onClick={() => setIsCreatingNew(true)}
              >
                <Plus size={12} /> Create New Profile
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">New Profile Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="e.g., Retail Demo Mappings"
              />
              <button 
                className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 mt-1"
                onClick={() => setIsCreatingNew(false)}
              >
                &larr; Cancel (Select Existing)
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isCreatingNew ? 'Create & Add' : 'Add to Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};
