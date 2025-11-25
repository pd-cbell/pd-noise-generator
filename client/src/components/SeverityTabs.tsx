import React, { useState } from 'react';
import { useStore, IncidentSeverity, SeverityConfig } from '../store/useStore';

export const SeverityTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<IncidentSeverity>('warning');
  const { severityConfigs, setSeverityConfig } = useStore();

  const severities: IncidentSeverity[] = ['warning', 'error', 'critical']; // Info is suppressed

  const currentConfig = severityConfigs[activeTab];

  const handleSliderChange = (setting: keyof SeverityConfig, value: number) => {
    setSeverityConfig(activeTab, { [setting]: value });
  };

  const handleMinMaxChange = (minOrMax: 'minAckSec' | 'maxAckSec' | 'minResolveSec' | 'maxResolveSec', value: number) => {
    setSeverityConfig(activeTab, { [minOrMax]: value });
  };

  return (
    <div className="mt-4">
      <div className="flex border-b border-gray-200">
        {severities.map(sev => (
          <button
            key={sev}
            onClick={() => setActiveTab(sev)}
            className={`
              py-2 px-4 text-sm font-medium capitalize -mb-px border-b-2
              ${activeTab === sev
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            {sev}
          </button>
        ))}
      </div>

      <div className="pt-4 space-y-4">
        {/* Time to Ack */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time to Acknowledge (seconds)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={currentConfig.minAckSec}
              onChange={(e) => handleMinMaxChange('minAckSec', Number(e.target.value))}
            />
            <span className="self-center text-gray-500">-</span>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={currentConfig.maxAckSec}
              onChange={(e) => handleMinMaxChange('maxAckSec', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Time to Resolve */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time to Resolve (seconds)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={currentConfig.minResolveSec}
              onChange={(e) => handleMinMaxChange('minResolveSec', Number(e.target.value))}
            />
            <span className="self-center text-gray-500">-</span>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={currentConfig.maxResolveSec}
              onChange={(e) => handleMinMaxChange('maxResolveSec', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Note Probability */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note Probability (0-1)</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={currentConfig.noteProbability}
            onChange={(e) => handleSliderChange('noteProbability', Number(e.target.value))}
          />
        </div>

        {/* Responder Probability */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Responder Probability (0-1)</label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={currentConfig.responderProbability}
            onChange={(e) => handleSliderChange('responderProbability', Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
};
