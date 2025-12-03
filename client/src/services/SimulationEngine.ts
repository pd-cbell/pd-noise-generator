import { useStore } from '../store/useStore';

export class SimulationEngine {
  private fireTimer: any | null = null;
  private evalTimer: any | null = null;
  private trendTimer: any | null = null;

  start() {
    console.log('[Engine] Starting simulation...');
    this.scheduleNextFire();
    this.startEvalLoop();
    this.startTrendLoop();
  }

  stop() {
    console.log('[Engine] Stopping simulation...');
    if (this.fireTimer) clearTimeout(this.fireTimer);
    if (this.evalTimer) clearTimeout(this.evalTimer);
    if (this.trendTimer) clearInterval(this.trendTimer);
    this.fireTimer = null;
    this.evalTimer = null;
    this.trendTimer = null;
  }

  private scheduleNextFire() {
    const { isGenerating, ratePerMinute, services, triggerIncident, addLog } = useStore.getState();

    if (!isGenerating) {
        // If paused/stopped, check again in 1s just in case state changes, or let the loop die?
        // Better: let the loop die. The `start()` method will restart it if needed?
        // ACTUALLY: The `useSimulation` hook handles start/stop.
        // If we pause, `isGenerating` becomes false. We should probably stop scheduling new fires.
        // But if we unpause, we need to restart firing. 
        // Does the Engine's `start()` method get called on unpause?
        // If `useSimulation` tracks `isManaging`, and `isManaging` stays true during pause, then `start()` is NOT called again.
        // So we MUST keep the loop alive or have a way to restart it.
        // EASIEST: Keep loop alive but do nothing if !isGenerating.
        this.fireTimer = setTimeout(() => this.scheduleNextFire(), 1000);
        return;
    }

    const rpm = Math.max(0, Number(ratePerMinute) || 0);
    if (rpm <= 0) {
        this.fireTimer = setTimeout(() => this.scheduleNextFire(), 1000);
        return;
    }

    // Poisson process: Inter-arrival time = -ln(1-u) / lambda
    const lambdaPerSec = rpm / 60;
    const u = Math.random();
    const safeU = u >= 1 ? 0.99 : u;
    const interArrivalSec = -Math.log(1 - safeU) / Math.max(lambdaPerSec, 1e-9);
    const delayMs = Math.max(250, interArrivalSec * 1000);

    this.fireTimer = setTimeout(async () => {
      const currentStore = useStore.getState();
      if (!currentStore.isGenerating) {
          this.scheduleNextFire(); // Reschedule to keep loop alive
          return;
      }

      const targets = currentStore.services.filter(s => s.include);
      
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        await triggerIncident(target);
      }

      this.scheduleNextFire();
    }, delayMs);
  }

  private startEvalLoop() {
    this.evalTimer = setInterval(() => {
      const { isManaging, evalTick } = useStore.getState();
      if (isManaging) {
        evalTick();
      }
    }, 1000); // 1Hz tick
  }

  private startTrendLoop() {
    this.trendTimer = setInterval(() => {
      const { activeIncidents, addMonitorTrendData } = useStore.getState();
      addMonitorTrendData(activeIncidents.length);
    }, 30000); // Sample every 30s
  }
}

export const simulationEngine = new SimulationEngine();
