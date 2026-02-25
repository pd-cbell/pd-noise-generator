import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useStore } from '../store/useStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ServerSimulationState {
  isRunning: boolean;
  activeIncidents: any[];
  totalEvents: number;
  log: any[];
  monitorTrend: any[];
  tracks: any[]; // Added tracks info
  metrics?: any;
}

interface SimulationContextType {
  currentSimState: ServerSimulationState | null;
  isSimRunning: boolean;
  socketStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  socketError: string | null;
  directorLaunchError: string | null;
  reconnectSocket: () => void;
  requestSimState: () => void;
  startSimulation: (overrideConfig?: any) => void;
  stopSimulation: () => void;
  stopTrack: (trackId: string) => void; // Added stopTrack
  injectGoldenDemo: (items: any[], mappingProfileId?: string) => Promise<void>;
  isLoading: boolean;
  ackIncident: (dedupKey: string) => void;
  resolveIncident: (dedupKey: string) => void;
  clearActiveIncidents: () => void;
  resolveAllIncidents: () => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, credentials } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [currentSimState, setCurrentSimState] = useState<ServerSimulationState | null>(null);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [socketError, setSocketError] = useState<string | null>(null);
  const [directorLaunchError, setDirectorLaunchError] = useState<string | null>(null);

  const startSimulation = useCallback((overrideConfig?: any) => {
    if (!(user && credentials)) {
      console.warn('Start simulation requested without authenticated user or credentials');
      setIsLoading(false);
      return;
    }

    if (!socketRef.current) {
      console.warn('Start simulation requested before socket connection is ready');
      setSocketStatus('error');
      setSocketError('Socket not connected');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const state = useStore.getState();

    // Ignore accidental event objects passed from onClick
    const overrideSafe =
      overrideConfig && typeof overrideConfig === 'object' && 'target' in overrideConfig
        ? undefined
        : overrideConfig;
    
    // Use override config (Golden Demo) or current store config
    const simConfig = overrideSafe || {
      pdSubdomain: state.pdSubdomain,
      ratePerMinute: state.ratePerMinute,
      severityWeights: state.severityWeights,
      autoHealConfig: state.autoHealConfig,
      resumeExistingEnabled: state.resumeExistingEnabled,
      sourceMix: state.sourceMix,
      burstProbability: state.burstProbability,
      majorIncidentProbability: state.majorIncidentProbability,
      responderAckRate: state.responderAckRate,
      teamFailureProbability: state.teamFailureProbability,
      severityConfigs: state.severityConfigs,
      changeRoutingKey: undefined,
      selectedServices: state.services.filter(svc => svc.include),
      selectedTeamIds: state.selectedTeamIds,
      mappingProfileId: state.selectedMappingProfileId,
    };

    // Merge pdRegion into credentials
    const fullCredentials = {
        ...credentials,
        pdRegion: state.pdRegion
    };

    // Clone to strip any non-serializable references
    const payload = {
      config: JSON.parse(JSON.stringify(simConfig)),
      credentials: JSON.parse(JSON.stringify(fullCredentials)),
    };

    socketRef.current.emit('start_simulation', payload, (err: any) => {
      if (err) {
        console.error('SimulationProvider: start_simulation callback error', err);
        setIsLoading(false);
      }
    });
  }, [user, credentials]);

  const stopSimulation = useCallback(() => {
    if (socketRef.current) {
      setIsLoading(true);
      socketRef.current.emit('stop_simulation');
    }
  }, []);

  const stopTrack = useCallback((trackId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('stop_track', { trackId }, (err: any) => {
        if (err) {
          console.error('SimulationProvider: stop_track callback error', err);
        }
      });
    }
  }, []);

  const injectGoldenDemo = useCallback((items: any[], mappingProfileId?: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!(socketRef.current && user && credentials)) {
        const msg = 'Socket not connected or credentials unavailable.';
        setDirectorLaunchError(msg);
        reject(new Error(msg));
        return;
      }

      setDirectorLaunchError(null);
      const pdSubdomain = useStore.getState().pdSubdomain;
      socketRef.current.emit('inject_golden_demo_items', { items, mappingProfileId, pdSubdomain }, (err: any) => {
        if (err) {
          const msg = err?.message || 'Failed to inject Golden Demo items';
          console.error('SimulationProvider: inject_golden_demo_items callback error', err);
          setDirectorLaunchError(msg);
          useStore.getState().addLog(`Director launch failed: ${msg}`, 'error');
          reject(new Error(msg));
          return;
        }
        setDirectorLaunchError(null);
        resolve();
      });
    });
  }, [user, credentials]);

  // Actions
  const ackIncident = useCallback((dedupKey: string) => {
      socketRef.current?.emit('ack_incident', dedupKey);
  }, []);

  const resolveIncident = useCallback((dedupKey: string) => {
      socketRef.current?.emit('resolve_incident', dedupKey);
  }, []);

  const clearActiveIncidents = useCallback(() => {
      socketRef.current?.emit('clear_incidents');
  }, []);

  const resolveAllIncidents = useCallback(() => {
      socketRef.current?.emit('resolve_all');
  }, []);


  const connectSocket = useCallback(() => {
    if (!user) {
      setSocketStatus('disconnected');
      setSocketError(null);
      return;
    }
    if (socketRef.current) return;

    setSocketStatus('connecting');
    setSocketError(null);
    setIsLoading(true);
    const socket = io(API_BASE, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('SimulationProvider: Socket Connected');
      setSocketStatus('connected');
      setSocketError(null);
      setDirectorLaunchError(null);
      setIsLoading(false);
      socket.emit('request_sim_state');
    });

    socket.on('connect_error', (err) => {
      console.error('SimulationProvider: Socket Connection Error', err);
      setSocketStatus('error');
      setSocketError(err?.message || 'Socket connection failed');
      setIsLoading(false);
    });

    socket.on('disconnect', () => {
        console.log('SimulationProvider: Socket Disconnected');
        setSocketStatus('disconnected');
        setCurrentSimState(null);
        setIsSimRunning(false);
        setIsLoading(false);
        setDirectorLaunchError(null);
      });

    socket.on('sim_state', (state: ServerSimulationState) => {
      console.log('SimulationProvider: State Sync', state);
      setCurrentSimState(state);
      setIsSimRunning(state.isRunning);
      setIsLoading(false);
    });

    socket.on('sim_tick', (state: ServerSimulationState) => {
      setCurrentSimState(state);
      setIsSimRunning(state.isRunning);
    });

    socket.on('sim_started', () => {
      setIsSimRunning(true);
      setIsLoading(false);
    });

    socket.on('sim_error', (payload: any) => {
      console.error('SimulationProvider: sim_error', payload);
      setIsLoading(false);
    });

      socket.on('sim_stopped', () => {
        setIsSimRunning(false);
        setIsLoading(false);
        // Don't clear state, let user see final stats
      });

      socket.on('track_run_started', (run: any) => {
        useStore.getState().upsertTrackRun(run);
      });

      socket.on('track_run_update', (run: any) => {
        useStore.getState().upsertTrackRun(run);
      });

      socket.on('track_run_finished', (run: any) => {
        useStore.getState().upsertTrackRun(run);
        useStore.getState().finishTrackRun(run.trackRunId);
      });

    socketRef.current = socket;
  }, [user]);

  useEffect(() => {
    connectSocket();
    if (!user) {
      setSocketStatus('disconnected');
      setSocketError(null);
      setIsLoading(false);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, connectSocket]);

  const requestSimState = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('request_sim_state');
    }
  }, []);

  const reconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    connectSocket();
  }, [connectSocket]);

  return (
    <SimulationContext.Provider value={{ 
        currentSimState, isSimRunning, socketStatus, socketError, directorLaunchError, reconnectSocket, requestSimState,
        startSimulation, stopSimulation, stopTrack, injectGoldenDemo, isLoading,
        ackIncident, resolveIncident, clearActiveIncidents, resolveAllIncidents
    }}>
      {children}
    </SimulationContext.Provider>
  );
};

export const useServerSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useServerSimulation must be used within a SimulationProvider');
  return context;
};
