import { Incident, SimulationConfig } from '../types';

interface SimulationState {
  isRunning: boolean;
  activeIncidents: Incident[];
  totalEvents: number;
  log: string[];
}

export class SimulationInstance {
  public userId: string;
  public config: SimulationConfig;
  public credentials: any;
  public state: SimulationState;
  private timer: NodeJS.Timeout | null = null;

  constructor(userId: string, config: SimulationConfig, credentials: any) {
    this.userId = userId;
    this.config = config;
    this.credentials = credentials;
    this.state = {
      isRunning: false,
      activeIncidents: [],
      totalEvents: 0,
      log: []
    };
  }

  start() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.timer = setInterval(() => this.tick(), 1000);
    this.addLog("Simulation started (Headless Mode)");
  }

  stop() {
    this.state.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.addLog("Simulation stopped");
  }

  private addLog(msg: string) {
      this.state.log.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
      if (this.state.log.length > 100) this.state.log.pop();
  }

  private async tick() {
    // Placeholder for full Poisson/Lifecycle logic
    // This proves the loop is running on the server
    if (Math.random() > 0.9) {
        this.state.totalEvents++;
        // this.addLog("Tick: Event generated (Mock)");
    }
  }
}

export class SimulationManager {
  private instances = new Map<string, SimulationInstance>();

  get(userId: string) {
    return this.instances.get(userId);
  }

  createOrUpdate(userId: string, config: SimulationConfig, credentials: any) {
    let instance = this.instances.get(userId);
    if (instance) {
        instance.config = config;
        instance.credentials = credentials;
    } else {
        instance = new SimulationInstance(userId, config, credentials);
        this.instances.set(userId, instance);
    }
    return instance;
  }
  
  delete(userId: string) {
      const instance = this.instances.get(userId);
      if (instance) instance.stop();
      this.instances.delete(userId);
  }
}

export const simulationManager = new SimulationManager();
