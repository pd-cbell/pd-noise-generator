import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { SimulationConfig } from '../../server/src/types'; // Assuming shared types

// TODO: Move API_BASE to a shared config
const API_BASE = 'http://localhost:3001';

interface ServerSimulationState {
  isRunning: boolean;
  activeIncidents: any[]; // Simplified for now
  totalEvents: number;
  log: string[];
}

interface UseServerSimulation {
  currentSimState: ServerSimulationState | null;
  isSimRunning: boolean;
  startSimulation: () => void;
  stopSimulation: () => void;
  isLoading: boolean;
}

export const useServerSimulation = (): UseServerSimulation => {
  const { user, credentials } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [currentSimState, setCurrentSimState] = useState<ServerSimulationState | null>(null);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get current simulation config from Zustand store
  const simConfig = useStore(state => ({
    ratePerMinute: state.ratePerMinute,
    severityWeights: state.severityWeights,
    autoHealConfig: state.autoHealConfig,
    resumeExistingEnabled: state.resumeExistingEnabled,
    sourceMix: state.sourceMix,
    burstProbability: state.burstProbability,
    severityConfigs: state.severityConfigs,
    // When sending config to server, we need selected services to be full objects, not just IDs
    selectedServices: state.services.filter(svc => svc.include), 
  }));

  const startSimulation = useCallback(() => {
    if (socketRef.current && user && credentials) {
      setIsLoading(true);
      // Send config and credentials for the server engine to use
      socketRef.current.emit('start_simulation', { config: simConfig, credentials });
    }
  }, [user, credentials, simConfig]);

  const stopSimulation = useCallback(() => {
    if (socketRef.current) {
      setIsLoading(true);
      socketRef.current.emit('stop_simulation');
    }
  }, []);

  useEffect(() => {
    if (user && !socketRef.current) {
      const socket = io(API_BASE, {
        withCredentials: true, // Send cookies for auth
      });

      socket.on('connect', () => {
        console.log('Connected to server simulation socket');
        setIsLoading(false);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from server simulation socket');
        setCurrentSimState(null);
        setIsSimRunning(false);
        setIsLoading(false);
      });

      socket.on('sim_state', (state: ServerSimulationState) => {
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
        // Maybe fetch initial state right after start confirmation
      });

      socket.on('sim_stopped', () => {
        setIsSimRunning(false);
        setIsLoading(false);
        setCurrentSimState(null); // Clear state on stop
      });

      socketRef.current = socket;
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  // If user logs out, disconnect socket
  useEffect(() => {
    if (!user && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [user]);

  return {
    currentSimState,
    isSimRunning,
    startSimulation,
    stopSimulation,
    isLoading,
  };
};