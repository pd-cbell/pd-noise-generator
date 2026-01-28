import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, RefreshCw } from 'lucide-react';
import { QuickDomainConfigModal } from './QuickDomainConfigModal';
import { useStore, MappingProfile, ServiceMapping, Service } from '../store/useStore';

type EditableMapping = Omit<ServiceMapping, 'id' | 'mappingProfileId'> & { id?: string };

const emptyProfile = (): MappingProfile => ({
  id: '',
  name: '',
  description: '',
  globalIncidentRoutingKey: '',
  serviceMappings: [],
});

const MappingProfilesPage: React.FC = () => {
  const {
    mappingProfiles,
    fetchMappingProfiles,
    createMappingProfile,
    updateMappingProfile,
    deleteMappingProfile,
    selectedMappingProfileId,
    setSelectedMappingProfileId,
    services,
    fetchServices,
    apiToken,
    fromEmail,
  } = useStore();

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<MappingProfile>(emptyProfile());
  const [mappings, setMappings] = useState<EditableMapping[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isQuickConfigOpen, setIsQuickConfigOpen] = useState(false);

  useEffect(() => {
    fetchMappingProfiles();
    if (services.length === 0) {
      fetchServices();
    }
  }, [fetchMappingProfiles, fetchServices, services.length]);

  useEffect(() => {
    if (isCreatingNew) return;
    if (activeProfileId) return;
    const initial = selectedMappingProfileId || mappingProfiles[0]?.id || null;
    if (initial) {
      loadProfile(initial);
    }
  }, [mappingProfiles, selectedMappingProfileId, activeProfileId, isCreatingNew]);

  const activeProfile = useMemo(
    () => mappingProfiles.find((p) => p.id === activeProfileId) || null,
    [mappingProfiles, activeProfileId]
  );

  const loadProfile = (id: string) => {
    const found = mappingProfiles.find((p) => p.id === id);
    if (!found) return;
    setIsCreatingNew(false);
    setActiveProfileId(id);
    setProfileForm({
      ...found,
      globalIncidentRoutingKey: found.globalIncidentRoutingKey || '',
      description: found.description || '',
    });
    setMappings(
      (found.serviceMappings || []).map((m) => ({
        ...m,
        incidentServiceId: m.incidentServiceId || '',
        incidentServiceName: m.incidentServiceName || '',
        incidentRoutingKeyOverride: m.incidentRoutingKeyOverride || '',
        changeServiceId: m.changeServiceId || '',
        changeServiceName: m.changeServiceName || '',
        useIncidentForChange: m.useIncidentForChange ?? true,
      }))
    );
    setSelectedMappingProfileId(id);
  };

  const handleNewProfile = () => {
    setIsCreatingNew(true);
    setActiveProfileId(null);
    const fresh = emptyProfile();
    setProfileForm(fresh);
    setMappings([]);
    setSelectedMappingProfileId(null);
  };

  const handleMappingChange = (index: number, updates: Partial<EditableMapping>) => {
    setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  };

  const handleServiceSelect = (index: number, field: 'incident' | 'change', serviceId: string) => {
    const svc: Service | undefined = services.find((s) => s.id === serviceId);
    if (field === 'incident') {
      handleMappingChange(index, {
        incidentServiceId: serviceId,
        incidentServiceName: svc?.name || serviceId,
      });
      if (mappings[index]?.useIncidentForChange) {
        handleMappingChange(index, {
          changeServiceId: '',
          changeServiceName: '',
        });
      }
    } else {
      handleMappingChange(index, {
        changeServiceId: serviceId,
        changeServiceName: svc?.name || serviceId,
      });
    }
  };

const handleAddMapping = () => {
  setMappings((prev) => [
    ...prev,
    {
      logicalServiceName: '',
      incidentServiceId: '',
      incidentServiceName: '',
      incidentRoutingKeyOverride: '',
      changeServiceId: '',
      changeServiceName: '',
      useIncidentForChange: true,
    },
  ]);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!profileForm.name.trim()) {
      alert('Profile name is required.');
      return;
    }

    setIsSaving(true);
    const cleanedMappings = mappings.filter((m) => (m.logicalServiceName || '').trim().length > 0);
    const payload = {
      name: profileForm.name.trim(),
      description: profileForm.description || '',
      globalIncidentRoutingKey: profileForm.globalIncidentRoutingKey || '',
      serviceMappings: cleanedMappings.length
        ? cleanedMappings.map((m) => ({
            logicalServiceName: m.logicalServiceName.trim(),
            incidentServiceId: m.incidentServiceId || undefined,
            incidentServiceName: m.incidentServiceName || undefined,
            incidentRoutingKeyOverride: m.incidentRoutingKeyOverride || undefined,
            changeServiceId: m.useIncidentForChange ? undefined : m.changeServiceId || undefined,
            changeServiceName: m.useIncidentForChange ? undefined : m.changeServiceName || undefined,
            useIncidentForChange: m.useIncidentForChange ?? true,
          }))
        : undefined,
    };

    try {
      let saved: MappingProfile;
      if (activeProfile) {
        saved = await updateMappingProfile(activeProfile.id, payload);
      } else {
        saved = await createMappingProfile(payload);
      }
      setIsCreatingNew(false);
      loadProfile(saved.id);
    } catch (e) {
      alert('Failed to save mapping profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeProfile) return;
    const confirmDelete = window.confirm(`Delete mapping profile "${activeProfile.name}"?`);
    if (!confirmDelete) return;
    await deleteMappingProfile(activeProfile.id);
    setActiveProfileId(null);
    setProfileForm(emptyProfile());
    setMappings([]);
  };

  const serviceOptions = services || [];
  const missingCredentials = !apiToken || !fromEmail;

  return (
    <div className="p-6 h-[calc(100vh-80px)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Mapping Profiles</h1>
          <p className="text-sm text-gray-500">Map Golden Demo services to real PagerDuty services.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-white border border-gray-200 rounded-md text-sm flex items-center gap-2 hover:bg-gray-50"
            onClick={fetchMappingProfiles}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm flex items-center gap-2 hover:bg-indigo-700"
            onClick={handleNewProfile}
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>
      </div>
      {services.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm flex items-center justify-between gap-3">
          <div>
            Load domain config to fetch teams and services for mapping profiles. Use the Configure tab to save your
            API token and From Email, then load teams/services.
          </div>
          <button
            className="px-3 py-1.5 bg-white border border-yellow-300 text-yellow-900 rounded-md text-xs font-semibold hover:bg-yellow-100"
            onClick={() => setIsQuickConfigOpen(true)}
          >
            Load Here
          </button>
        </div>
      )}
      {missingCredentials && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md text-sm flex items-center justify-between gap-3">
          <div>
            Missing credentials: API token and From Email are required to load services. Use the Configure tab to
            add credentials.
          </div>
          <button
            className="px-3 py-1.5 bg-white border border-blue-300 text-blue-900 rounded-md text-xs font-semibold hover:bg-blue-100"
            onClick={() => setIsQuickConfigOpen(true)}
          >
            Load Here
          </button>
        </div>
      )}
      <QuickDomainConfigModal isOpen={isQuickConfigOpen} onClose={() => setIsQuickConfigOpen(false)} />

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-64 bg-white border border-gray-200 rounded-lg p-3 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Profiles</h3>
          <div className="space-y-2">
            {mappingProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => loadProfile(profile.id)}
                className={`w-full text-left border rounded-md px-3 py-2 text-sm transition ${
                  activeProfileId === profile.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-800">{profile.name}</div>
                {profile.description && <div className="text-xs text-gray-500 line-clamp-2">{profile.description}</div>}
                <div className="text-[11px] text-gray-400 mt-1">
                  {profile.serviceMappings?.length || 0} mappings
                  {selectedMappingProfileId === profile.id ? ' • Active in Director' : ''}
                </div>
              </button>
            ))}
            {mappingProfiles.length === 0 && (
              <div className="text-sm text-gray-500">No profiles yet. Create one to get started.</div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Profile Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Customer A – FinTech"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Description</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  rows={2}
                  value={profileForm.description || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  placeholder="Optional description or usage notes"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Global Incident Routing Key</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={profileForm.globalIncidentRoutingKey || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, globalIncidentRoutingKey: e.target.value })}
                  placeholder="Overrides per-service only when blank"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              {activeProfile && (
                <button
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm flex items-center gap-2 hover:bg-red-100"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Service Mappings</h3>
                <p className="text-xs text-gray-500">Map Golden Demo logical services to PagerDuty services.</p>
              </div>
              <button
                className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm flex items-center gap-2 hover:bg-gray-50"
                onClick={handleAddMapping}
              >
                <Plus className="w-4 h-4" />
                Add Mapping
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 rounded-md">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Logical Service</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Incident Service</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Incident Routing Key</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Change Service</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Use Incident?</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping, idx) => {
                    const incidentLabel = mapping.incidentServiceName || mapping.incidentServiceId;
                    const changeLabel = mapping.changeServiceName || mapping.changeServiceId;
                    return (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2 align-top">
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            value={mapping.logicalServiceName}
                            onChange={(e) => handleMappingChange(idx, { logicalServiceName: e.target.value })}
                            placeholder="Payments DB"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            value={mapping.incidentServiceId || ''}
                            onChange={(e) => handleServiceSelect(idx, 'incident', e.target.value)}
                          >
                            <option value="">Select service</option>
                            {serviceOptions.map((svc) => (
                              <option key={svc.id} value={svc.id}>{svc.name}</option>
                            ))}
                          </select>
                          {incidentLabel && <p className="text-[11px] text-gray-500 mt-1">{incidentLabel}</p>}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            value={mapping.incidentRoutingKeyOverride || ''}
                            onChange={(e) => handleMappingChange(idx, { incidentRoutingKeyOverride: e.target.value })}
                            placeholder="Optional override"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          {mapping.useIncidentForChange ? (
                            <div className="text-xs text-gray-500 italic">Using incident service</div>
                          ) : (
                            <select
                              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                              value={mapping.changeServiceId || ''}
                              onChange={(e) => handleServiceSelect(idx, 'change', e.target.value)}
                              disabled={mapping.useIncidentForChange}
                            >
                              <option value="">Select service</option>
                              {serviceOptions.map((svc) => (
                                <option key={svc.id} value={svc.id}>{svc.name}</option>
                              ))}
                            </select>
                          )}
                          {!mapping.useIncidentForChange && changeLabel && (
                            <p className="text-[11px] text-gray-500 mt-1">{changeLabel}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-center">
                          <input
                            type="checkbox"
                            checked={mapping.useIncidentForChange}
                            onChange={(e) =>
                              handleMappingChange(idx, {
                                useIncidentForChange: e.target.checked,
                                ...(e.target.checked
                                  ? { changeServiceId: '', changeServiceName: '' }
                                  : {}),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <button
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleRemoveMapping(idx)}
                            aria-label="Remove mapping"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {mappings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                        No mappings yet. Add mappings to link Golden Demo services to PagerDuty services.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MappingProfilesPage;
