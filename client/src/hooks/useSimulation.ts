import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { simulationEngine } from '../services/SimulationEngine';

export function useSimulation() {
  const isRunning = useStore((state) => state.isRunning);
  // Use a ref to track if we've started to avoid double-start in strict mode
  const engineStarted = useRef(false);

  useEffect(() => {
    if (isRunning && !engineStarted.current) {
      simulationEngine.start();
      engineStarted.current = true;
    } else if (!isRunning && engineStarted.current) {
      simulationEngine.stop();
      engineStarted.current = false;
    }

    // Cleanup on unmount
    return () => {
      if (engineStarted.current) {
        simulationEngine.stop();
        engineStarted.current = false;
      }
    };
  }, [isRunning]);
}
