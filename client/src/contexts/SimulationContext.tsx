import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useStore } from '../store/useStore';

// TODO: Move API_BASE to a shared config
const API_BASE = 'http://localhost:3001';

interface ServerSimulationState {
  isRunning: boolean;
  activeIncidents: any[];
  totalEvents: number;
  log: any[];
  monitorTrend: any[];
}

interface SimulationContextType {
  currentSimState: ServerSimulationState | null;
  isSimRunning: boolean;
  startSimulation: () => void;
  stopSimulation: () => void;
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

  const startSimulation = useCallback(() => {
    if (socketRef.current && user && credentials) {
      setIsLoading(true);
      const state = useStore.getState();
      const simConfig = {
        ratePerMinute: state.ratePerMinute,
        severityWeights: state.severityWeights,
        autoHealConfig: state.autoHealConfig,
        resumeExistingEnabled: state.resumeExistingEnabled,
        sourceMix: state.sourceMix,
        burstProbability: state.burstProbability,
        severityConfigs: state.severityConfigs,
        changeRoutingKey: state.campaignConfig.importedChangeRoutingKey,
        selectedServices: state.services.filter(svc => svc.include),
        selectedTeamIds: state.selectedTeamIds, // New: Pass selected teams
      };
      socketRef.current.emit('start_simulation', { config: simConfig, credentials });
    }
  }, [user, credentials]);

  const stopSimulation = useCallback(() => {
    if (socketRef.current) {
      setIsLoading(true);
      socketRef.current.emit('stop_simulation');
    }
  }, []);

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


  useEffect(() => {
    if (user && !socketRef.current) {
      setIsLoading(true);
      const socket = io(API_BASE, {
        withCredentials: true,
      });

      socket.on('connect', () => {
        console.log('SimulationProvider: Socket Connected');
        setIsLoading(false);
      });

      socket.on('connect_error', (err) => {
        console.error('SimulationProvider: Socket Connection Error', err);
      });

      socket.on('disconnect', () => {
        console.log('SimulationProvider: Socket Disconnected');
        setCurrentSimState(null);
        setIsSimRunning(false);
        setIsLoading(false);
      });

      socket.on('sim_state', (state: ServerSimulationState) => {
        console.log('SimulationProvider: State Sync', state);
        setCurrentSimState(state);
        setIsSimRunning(state.isRunning);
        setIsLoading(false);
      });

      socket.on('sim_tick', (state: ServerSimulationState) => {
        console.log('SimulationProvider: Tick', state);
        setCurrentSimState(state);
        setIsSimRunning(state.isRunning);
      });

      socket.on('sim_started', () => {
        setIsSimRunning(true);
        setIsLoading(false);
      });

      socket.on('sim_stopped', () => {
        setIsSimRunning(false);
        setIsLoading(false);
        // Don't clear state, let user see final stats
      });

      socketRef.current = socket;
    } else if (!user && socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsLoading(false);
    } else if (!user) {
        setIsLoading(false);
    }

    return () => {
      // We generally don't want to disconnect on unmount if we want background persistence across navigation,
      // but since the Provider wraps App, unmount means closing app.
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  return (
    <SimulationContext.Provider value={{ 
        currentSimState, isSimRunning, startSimulation, stopSimulation, isLoading,
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
