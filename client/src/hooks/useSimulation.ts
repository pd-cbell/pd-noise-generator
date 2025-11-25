import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { simulationEngine } from '../services/SimulationEngine';

export function useSimulation() {
  const isManaging = useStore((state) => state.isManaging);
  // Use a ref to track if we've started to avoid double-start in strict mode
  const engineStarted = useRef(false);

  useEffect(() => {
    if (isManaging && !engineStarted.current) {
      simulationEngine.start();
      engineStarted.current = true;
    } else if (!isManaging && engineStarted.current) {
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
  }, [isManaging]);
}
