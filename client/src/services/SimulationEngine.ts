import { useStore } from '../store/useStore';

export class SimulationEngine {
  private fireTimer: NodeJS.Timeout | null = null;
  private evalTimer: NodeJS.Timeout | null = null;
  private trendTimer: NodeJS.Timeout | null = null;

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
    const { isRunning, ratePerMinute, services, triggerIncident, addLog } = useStore.getState();

    if (!isRunning) return;

    const rpm = Math.max(0, Number(ratePerMinute) || 0);
    if (rpm <= 0) {
        // If rate is 0, check again in 1 second to see if it changed
        this.fireTimer = setTimeout(() => this.scheduleNextFire(), 1000);
        return;
    }

    // Poisson process: Inter-arrival time = -ln(1-u) / lambda
    const lambdaPerSec = rpm / 60;
    const u = Math.random();
    // Avoid u=1 to prevent Infinity
    const safeU = u >= 1 ? 0.99 : u;
    const interArrivalSec = -Math.log(1 - safeU) / Math.max(lambdaPerSec, 1e-9);
    const delayMs = Math.max(250, interArrivalSec * 1000); // Cap minimum delay at 250ms

    this.fireTimer = setTimeout(async () => {
      const currentStore = useStore.getState();
      if (!currentStore.isRunning) return;

      // Targeting Logic
      const targets = currentStore.services.filter(s => s.include);
      
      if (targets.length === 0) {
        // No targets, just wait
      } else {
        // Pick a random target
        const target = targets[Math.floor(Math.random() * targets.length)];
        await triggerIncident(target);
      }

      this.scheduleNextFire();
    }, delayMs);
  }

  private startEvalLoop() {
    this.evalTimer = setInterval(() => {
      const { isRunning, evalTick } = useStore.getState();
      if (isRunning) {
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
