import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';

interface QuickDomainConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickDomainConfigModal: React.FC<QuickDomainConfigModalProps> = ({ isOpen, onClose }) => {
  const { apiToken, fromEmail, pdSubdomain, setCredentials, fetchTeams, fetchServices } = useStore();
  const { updateCredentials } = useAuth();
  const [localToken, setLocalToken] = useState(apiToken || '');
  const [localEmail, setLocalEmail] = useState(fromEmail || '');
  const [localSubdomain, setLocalSubdomain] = useState(pdSubdomain || '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoad = async () => {
    setError(null);
    if (!localSubdomain.trim() || !localToken.trim() || !localEmail.trim()) {
      setError('PD Subdomain, API Token, and From Email are required.');
      return;
    }
    setIsLoading(true);
    setCredentials({
      pdSubdomain: localSubdomain.trim(),
      apiToken: localToken.trim(),
      fromEmail: localEmail.trim(),
    });
    try {
      await updateCredentials({
        apiToken: localToken.trim(),
        fromEmail: localEmail.trim(),
      });
      await fetchTeams();
      await fetchServices();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to load teams/services.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Load Domain Config</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">PD Subdomain</label>
            <input
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. pdt-orbitpay"
              value={localSubdomain}
              onChange={(e) => setLocalSubdomain(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">API Token</label>
            <input
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="PagerDuty API token"
              value={localToken}
              onChange={(e) => setLocalToken(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">From Email</label>
            <input
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="you@company.com"
              value={localEmail}
              onChange={(e) => setLocalEmail(e.target.value)}
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLoad}
            disabled={isLoading}
            className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {isLoading ? 'Loading...' : 'Load Services'}
          </button>
        </div>
      </div>
    </div>
  );
};
