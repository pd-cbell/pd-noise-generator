import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Clock, Calendar, FileText } from 'lucide-react';

interface Session {
  id: string;
  name: string | null;
  source?: 'PRESENTER' | 'DIRECTOR' | 'WEBHOOK';
  mappingProfileId?: string | null;
  mappingProfileName?: string | null;
  launchedByUserId?: string | null;
  launchedByName?: string | null;
  launchedByEmail?: string | null;
  trackRunId?: string | null;
  startedAt: string;
  endedAt: string | null;
  metricsSnapshotJson: any;
  notes: string | null;
  goldenDemo?: { name?: string };
}

interface SessionHistoryProps {
  goldenDemoId: string;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ goldenDemoId }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      setIsLoading(true);
      try {
        const data = await api.getSessions(goldenDemoId);
        setSessions(data);
      } catch (error) {
        console.error("Failed to load sessions", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSessions();
  }, [goldenDemoId]);

  if (isLoading) return <div className="text-gray-500 text-sm">Loading history...</div>;

  if (sessions.length === 0) return <div className="text-gray-400 text-sm italic">No past sessions found.</div>;

  const sourceLabel = (source?: Session['source']) => {
    if (source === 'DIRECTOR') return 'Director';
    if (source === 'WEBHOOK') return 'Webhook';
    return 'Presenter';
  };

  return (
    <div className="space-y-4">
      {sessions.map(session => (
        <div key={session.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium text-gray-900">{session.name || 'Untitled Session'}</div>
            <div className="text-gray-500 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(session.startedAt).toLocaleDateString()}
            </div>
          </div>
          
          <div className="flex gap-4 text-xs text-gray-600 mb-2">
             <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {session.endedAt 
                    ? `${Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)} mins` 
                    : 'In Progress'}
             </div>
             {session.metricsSnapshotJson && (
                 <div>
                     Events: {session.metricsSnapshotJson.totalEvents || 0}
                 </div>
             )}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] mb-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {sourceLabel(session.source)}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
              Launched by: {session.launchedByName || session.launchedByEmail || session.launchedByUserId || 'Unknown'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
              Mapping: {session.mappingProfileName || (session.mappingProfileId ? 'Mapped Profile' : 'None')}
            </span>
          </div>

          {session.notes && (
              <div className="bg-white p-2 rounded border border-gray-100 text-gray-700 italic">
                  <FileText className="w-3 h-3 inline mr-1 text-gray-400" />
                  {session.notes}
              </div>
          )}
        </div>
      ))}
    </div>
  );
};
