import React, { useEffect, useMemo, useState } from 'react';
import { GoldenDemo } from '../../../server/src/types';
import { useStore } from '../store/useStore';
import { X, Save, Plus, Trash2, ArrowUp, ArrowDown, Copy, Upload } from 'lucide-react';
import { convertCampaignFailureToGoldenDemoItems, convertCruxEventGroupToGoldenDemoItems, detectImportFormat, ImportedGoldenDemoEvent } from '../utils/importers';

type StageKey = 'routine_change_minor' | 'business_impact' | 'triage_context' | 'resolution_pir';

type EditableEvent = ImportedGoldenDemoEvent;

type StageState = Record<StageKey, string>;

interface GoldenDemoEditorProps {
  demo: GoldenDemo;
  onClose: () => void;
  isNew?: boolean;
}

const stageLabels: Record<StageKey, string> = {
  routine_change_minor: 'Routine Change & Minor Incidents',
  business_impact: 'Business Impact',
  triage_context: 'Triage & Context',
  resolution_pir: 'Resolution & Post-Incident Review',
};

const defaultStageState: StageState = {
  routine_change_minor: '',
  business_impact: '',
  triage_context: '',
  resolution_pir: '',
};

const safeStringify = (obj: any) => {
  try {
    return JSON.stringify(obj || {}, null, 2);
  } catch {
    return '{}';
  }
};

const maturityOptions = ['Reactive', 'Proactive', 'Preventative'];

const normalizeEvents = (items: any[] | undefined): EditableEvent[] => {
  if (!items || !Array.isArray(items)) return [];
  return items.map((item, idx) => {
    const logicalServiceName =
      item.logicalServiceName ||
      item.service ||
      item.serviceName ||
      item.payload?.custom_details?.service_name ||
      '';
    const payloadText = safeStringify(item.payload || {});
    const delaySeconds =
      typeof item.delaySeconds === 'number'
        ? item.delaySeconds
        : typeof item.offsetMinutes === 'number'
        ? Math.round(item.offsetMinutes * 60)
        : 0;
    return {
      id: item.id || item.stepName || `event-${idx}`,
      type: item.eventType || item.type || 'incident',
      logicalServiceName,
      summary: item.summary || item.stepName || item.payload?.summary || '',
      offsetSeconds: Math.max(0, delaySeconds),
      payloadText,
      repeatCount: item.repeatCount || item.times || 1,
      severity: item.severity,
      slackMessageTemplate: item.slackMessageTemplate,
      changeRoutingKey: item.changeRoutingKey || item.integrationKey,
      integrationKey: item.integrationKey,
    };
  });
};

const normalizeStages = (configJson: any): StageState => {
  const stages = configJson?.narrative?.stages || {};
  return {
    routine_change_minor: stages.routine_change_minor?.text || '',
    business_impact: stages.business_impact?.text || '',
    triage_context: stages.triage_context?.text || '',
    resolution_pir: stages.resolution_pir?.text || '',
  };
};

const normalizeImportedOffsets = (events: ImportedGoldenDemoEvent[]): ImportedGoldenDemoEvent[] =>
  events.map((evt) => {
    const baseSeconds =
      typeof evt.offsetSeconds === 'number'
        ? evt.offsetSeconds
        : typeof (evt as any).delaySeconds === 'number'
        ? (evt as any).delaySeconds
        : typeof (evt as any).offsetMinutes === 'number'
        ? Math.round((evt as any).offsetMinutes * 60)
        : 0;
    return { ...evt, offsetSeconds: Math.max(0, baseSeconds) };
  });

const convertImportText = (text: string): ImportedGoldenDemoEvent[] => {
  const parsed = JSON.parse(text);
  const format = detectImportFormat(parsed);
  if (format === 'campaignFailure') {
    return convertCampaignFailureToGoldenDemoItems(parsed);
  }
  if (format === 'cruxEventGroup') {
    return convertCruxEventGroupToGoldenDemoItems(parsed);
  }
  throw new Error('Unsupported import format: expected campaign failure or Crux event group JSON.');
};

export const GoldenDemoEditorV2: React.FC<GoldenDemoEditorProps> = ({ demo, onClose, isNew }) => {
  const { updateGoldenDemo, createGoldenDemo, addLog } = useStore();

  const [meta, setMeta] = useState({
    name: demo.name,
    vertical: demo.vertical || '',
    maturityLevel: demo.maturityLevel || '',
    narrative: demo.narrative,
    personaNotes: demo.personaNotes || '',
    description: demo.configJson?.description || '',
  });

  const [stageState, setStageState] = useState<StageState>(defaultStageState);
  const [events, setEvents] = useState<EditableEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<EditableEvent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importBaseOffset, setImportBaseOffset] = useState<number>(0);

  useEffect(() => {
    setStageState(normalizeStages(demo.configJson));
    setEvents(normalizeEvents(demo.configJson?.items));
  }, [demo]);

  const handleEventChange = (field: keyof EditableEvent, value: any) => {
    if (!editingEvent) return;
    setEditingEvent({ ...editingEvent, [field]: value });
  };

  const persistEvent = () => {
    if (!editingEvent) return;
    if (!editingEvent.logicalServiceName.trim()) {
      setError('Logical service name is required.');
      return;
    }
    if (!editingEvent.type.trim()) {
      setError('Event type is required.');
      return;
    }
    setError(null);
    const updated = events.some((e) => e.id === editingEvent.id)
      ? events.map((e) => (e.id === editingEvent.id ? editingEvent : e))
      : [...events, editingEvent];
    setEvents(updated);
    setEditingEvent(null);
  };

  const handleAddEvent = () => {
    setEditingEvent({
      id: crypto.randomUUID(),
      type: 'incident',
      logicalServiceName: '',
      summary: '',
      offsetSeconds: 0,
      payloadText: '{}',
      repeatCount: 1,
    });
  };

  const handleEditEvent = (event: EditableEvent) => {
    setEditingEvent(event);
  };

  const handleDuplicateEvent = (event: EditableEvent) => {
    const copy: EditableEvent = { ...event, id: crypto.randomUUID(), summary: `${event.summary} (Copy)` };
    setEvents((prev) => [...prev, copy]);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const moveEvent = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= events.length) return;
    const updated = [...events];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setEvents(updated);
  };

  const validateAndParsePayload = (payloadText: string) => {
    try {
      return JSON.parse(payloadText || '{}');
    } catch (e: any) {
      throw new Error(`Invalid JSON payload: ${e.message}`);
    }
  };

  const buildConfigJson = () => {
    const existing = demo.configJson || {};
    const items = events.map((evt, idx) => {
      const existingMatch =
        (existing.items || []).find((i: any) => i.id === evt.id) || (existing.items || [])[idx] || {};
      const payload = validateAndParsePayload(evt.payloadText);
      // Ensure service name is present for mapping
      if (!payload.custom_details) payload.custom_details = {};
      payload.custom_details.service_name = evt.logicalServiceName;

      const delaySeconds = Math.max(0, Math.round(evt.offsetSeconds || 0));

      return {
        ...existingMatch,
        id: evt.id,
        stepName: evt.summary || existingMatch.stepName,
        service: evt.logicalServiceName,
        logicalServiceName: evt.logicalServiceName,
        delaySeconds,
        repeatCount: evt.repeatCount || 1,
        eventType: evt.type,
        severity: evt.severity,
        payload,
        slackMessageTemplate: evt.slackMessageTemplate,
        changeRoutingKey: evt.changeRoutingKey || evt.integrationKey,
        integrationKey: evt.integrationKey,
      };
    });

  return {
    ...existing,
    name: existing.name || meta.name,
    description: meta.description || existing.description || '',
      narrative: {
        ...(existing.narrative || {}),
        stages: {
          ...(existing.narrative?.stages || {}),
          routine_change_minor: { text: stageState.routine_change_minor },
          business_impact: { text: stageState.business_impact },
          triage_context: { text: stageState.triage_context },
          resolution_pir: { text: stageState.resolution_pir },
        },
      },
      items,
    };
  };

  const handleSave = async () => {
    if (!meta.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!meta.vertical.trim()) {
      setError('Vertical is required.');
      return;
    }
    if (!meta.maturityLevel.trim()) {
      setError('Maturity is required.');
      return;
    }
    for (const evt of events) {
      if (!evt.logicalServiceName.trim()) {
        setError('Each event requires a logical service name.');
        return;
      }
      if (!evt.type.trim()) {
        setError('Each event requires an event type.');
        return;
      }
      // Validate payload JSON
      try {
        validateAndParsePayload(evt.payloadText);
      } catch (e: any) {
        setError(e.message);
        return;
      }
      if (evt.offsetSeconds == null || isNaN(evt.offsetSeconds)) {
        setError('Each event requires an offset in seconds.');
        return;
      }
    }
    setError(null);
    setIsSaving(true);
    try {
      const updatedConfig = buildConfigJson();
      if (isNew || demo.id === 'new') {
        const created = await createGoldenDemo({
          name: meta.name.trim(),
          vertical: meta.vertical,
          maturityLevel: meta.maturityLevel,
          narrative: meta.narrative,
          personaNotes: meta.personaNotes,
          configJson: updatedConfig,
        });
        addLog(`Created Golden Demo "${created.name}"`, 'info');
      } else {
        await updateGoldenDemo(demo.id, {
          name: meta.name.trim(),
          vertical: meta.vertical,
          maturityLevel: meta.maturityLevel,
          narrative: meta.narrative,
          personaNotes: meta.personaNotes,
          configJson: updatedConfig,
        });
        addLog(`Updated Golden Demo "${meta.name}"`, 'info');
      }
      onClose();
    } catch (e) {
      setError('Failed to save Golden Demo.');
    } finally {
      setIsSaving(false);
    }
  };

  const stagedEvents = useMemo(
    () =>
      events.map((evt, idx) => ({
        ...evt,
        displayIndex: idx + 1,
      })),
    [events]
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
            <h3 className="font-bold text-gray-900">Edit Golden Demo</h3>
            <p className="text-xs text-gray-500">Adjust metadata, narrative stages, and events.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-800">Metadata</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={meta.name}
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Vertical</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={meta.vertical}
                  onChange={(e) => setMeta({ ...meta, vertical: e.target.value })}
                  required
                  placeholder="Retail, FSI, Tech..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Maturity</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  value={meta.maturityLevel}
                  onChange={(e) => setMeta({ ...meta, maturityLevel: e.target.value })}
                  required
                >
                  <option value="">Select maturity</option>
                  {maturityOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={meta.description}
                  onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                  placeholder="Short scenario description"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Narrative (overall)</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={3}
                value={meta.narrative}
                onChange={(e) => setMeta({ ...meta, narrative: e.target.value })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">Narrative Stages</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(stageLabels) as StageKey[]).map((key) => (
                <div key={key} className="border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">{stageLabels[key]}</div>
                  <textarea
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    rows={3}
                    value={stageState[key]}
                    onChange={(e) => setStageState({ ...stageState, [key]: e.target.value })}
                    placeholder="Stage narrative..."
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">Events</h4>
              <button
                className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm flex items-center gap-2 hover:bg-indigo-700"
                onClick={handleAddEvent}
              >
                <Plus className="w-4 h-4" />
                Add Event
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button
                className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm flex items-center gap-2 hover:bg-gray-50"
                onClick={() => setIsImporting(true)}
              >
                <Upload className="w-4 h-4" />
                Import Campaign Failure JSON
              </button>
              <span className="text-xs text-gray-500">Append or replace events from legacy campaign failures.</span>
            </div>

            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
              {stagedEvents.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No events yet. Add events to define the scenario.</div>
              )}
              {stagedEvents.map((evt, idx) => (
                <div
                  key={evt.id}
                  className={`p-3 flex items-center gap-3 ${evt.type === 'change' ? 'bg-pink-50' : ''}`}
                >
                  <div className="w-10 text-xs text-gray-500 text-center">{evt.displayIndex}</div>
                  <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800 truncate">
                        {evt.summary || 'Untitled Event'} • {evt.type}
                      </div>
                      <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                        <span>{evt.logicalServiceName}</span>
                        <span>• Offset (s, relative)</span>
                        <input
                          type="number"
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs"
                          value={evt.offsetSeconds || 0}
                          min={0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setEvents((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, offsetSeconds: val } : item))
                            );
                          }}
                        />
                      </div>
                    </div>
                <div className="flex items-center gap-2">
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => moveEvent(idx, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => moveEvent(idx, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => handleDuplicateEvent(evt)}
                      aria-label="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      onClick={() => handleEditEvent(evt)}
                      aria-label="Edit"
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteEvent(evt.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
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
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Event editor modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h4 className="font-semibold text-gray-800">Edit Event</h4>
              <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Type</label>
                    <select
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      value={editingEvent.type}
                    onChange={(e) => handleEventChange('type', e.target.value)}
                  >
                    <option value="incident">incident</option>
                    <option value="alert">alert</option>
                    <option value="change">change</option>
                    <option value="note">note</option>
                    <option value="automation">automation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Logical Service</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={editingEvent.logicalServiceName}
                    onChange={(e) => handleEventChange('logicalServiceName', e.target.value)}
                    placeholder="Payments DB"
                    required
                  />
                </div>
              </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Summary / Title</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      value={editingEvent.summary}
                      onChange={(e) => handleEventChange('summary', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Offset (seconds, relative to previous)</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      value={editingEvent.offsetSeconds || 0}
                      onChange={(e) => handleEventChange('offsetSeconds', Math.max(0, Number(e.target.value)))}
                      min={0}
                    />
                  </div>
                </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Severity (optional)</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={editingEvent.severity || ''}
                    onChange={(e) => handleEventChange('severity', e.target.value)}
                    placeholder="info|warning|error|critical"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Repeat Count</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={editingEvent.repeatCount || 1}
                    onChange={(e) => handleEventChange('repeatCount', Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
              {editingEvent.type === 'change' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Change Routing Key (optional)</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      value={editingEvent.changeRoutingKey || editingEvent.integrationKey || ''}
                      onChange={(e) =>
                        handleEventChange('changeRoutingKey', e.target.value.trim())
                      }
                      placeholder="Paste a Change Events routing key"
                    />
                  </div>
                  <div className="text-xs text-gray-500 flex items-end">
                    If provided, overrides mapping/service lookup for change events.
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Slack Message Template (optional)</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={editingEvent.slackMessageTemplate || ''}
                  onChange={(e) => handleEventChange('slackMessageTemplate', e.target.value)}
                  placeholder="Slack template for this event"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Payload / Custom Details (JSON)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                  rows={8}
                  value={editingEvent.payloadText}
                  onChange={(e) => handleEventChange('payloadText', e.target.value)}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Ensure JSON is valid. service_name will be set to the logical service for mapping profiles.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => setEditingEvent(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                onClick={persistEvent}
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h4 className="font-semibold text-gray-800">Import Campaign Failure JSON</h4>
                <p className="text-xs text-gray-500">Paste legacy campaign failure JSON to convert into Golden Demo events.</p>
              </div>
              <button onClick={() => { setIsImporting(false); setImportPreview([]); setImportError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                  {importError}
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Import JSON (Campaign Failure or Crux)</label>
                    <textarea
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                      rows={12}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder='{ "items": [ ... ] } or { "event_group": { "event_group_items": [...] } }'
                    />
                    <input
                      type="file"
                      accept=".json,.txt,application/json,text/plain"
                      className="text-xs text-gray-600"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const content = evt.target?.result as string;
                          setImportText(content || '');
                        };
                        reader.onerror = () => {
                          setImportError('Failed to read file.');
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Options</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={() => setImportMode('append')}
                        />
                        Append to existing events
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                        />
                        Replace existing events
                      </label>
                      <div className="pt-2 border-t border-gray-100 space-y-2">
                        <div>
                          <div className="text-[11px] text-gray-500 font-semibold mb-1">Base Offset (minutes)</div>
                          <input
                            type="number"
                            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                            value={importBaseOffset}
                            min={-60}
                            max={120}
                            onChange={(e) => setImportBaseOffset(Number(e.target.value))}
                          />
                          <p className="text-[11px] text-gray-500">Applied to imported event timings (clamped to 0).</p>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500 font-semibold mb-1">Detected Format</div>
                          <div className="text-[11px] text-gray-600">
                            {importPreview.length > 0
                              ? `Parsed ${importPreview.length} events`
                              : importError || 'Paste or upload and parse to detect'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-md text-sm flex items-center gap-2 justify-center hover:bg-indigo-700"
                      onClick={() => {
                        try {
                        const converted = normalizeImportedOffsets(convertImportText(importText));
                        setImportPreview(converted);
                        setImportError(null);
                        } catch (e: any) {
                          setImportError(e.message || 'Failed to parse JSON.');
                          setImportPreview([]);
                        }
                      }}
                    >
                      Parse
                    </button>
                    <p className="text-[11px] text-gray-500">
                      Supports legacy campaign failure arrays/objects and Crux event_group.event_group_items payloads.
                    </p>
                  </div>
                </div>

              <div>
                <h5 className="text-sm font-semibold text-gray-800 mb-2">Preview ({importPreview.length} events)</h5>
                {importPreview.length === 0 ? (
                  <div className="text-sm text-gray-500 border border-dashed border-gray-200 p-3 rounded">Nothing parsed yet.</div>
                ) : (
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Logical Service</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Offset (s)</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Repeat</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Interval (s)</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((evt, idx) => (
                          <tr key={evt.id} className="border-t">
                            <td className="px-3 py-2 text-xs text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 text-sm text-gray-800">{evt.type}</td>
                            <td className="px-3 py-2 text-sm text-gray-800">{evt.logicalServiceName}</td>
                            <td className="px-3 py-2 text-sm text-gray-800">{evt.offsetSeconds ?? Math.round((evt as any).offsetMinutes || 0)}</td>
                            <td className="px-3 py-2 text-sm text-gray-800">{evt.repeatCount || 1}</td>
                            <td className="px-3 py-2 text-sm text-gray-800">{evt.intervalSeconds || 0}</td>
                            <td className="px-3 py-2 text-sm text-gray-800 truncate">{evt.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => { setIsImporting(false); setImportPreview([]); setImportError(null); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    disabled={importPreview.length === 0}
                    onClick={() => {
                      if (importPreview.length === 0) return;
                  const adjusted = importPreview.map((evt) => {
                    const baseSeconds = Math.max(
                      0,
                      (evt.offsetSeconds ?? Math.round((evt as any).offsetMinutes || 0)) + importBaseOffset * 60
                    );
                    const delaySeconds = Math.max(0, Math.round(baseSeconds));
                    const importMeta = {
                      ...(evt.importMeta || {}),
                      originalOffsetSeconds: evt.offsetSeconds,
                    };
                    return { ...evt, offsetSeconds: baseSeconds, importMeta, delaySeconds };
                  });
                  if (importMode === 'replace') {
                    setEvents(adjusted);
                  } else {
                    setEvents((prev) => [...prev, ...adjusted]);
                  }
                  setIsImporting(false);
                  setImportPreview([]);
                  setImportText('');
                  setImportError(null);
                  setImportBaseOffset(0);
                }}
              >
                Import {importPreview.length} events
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
