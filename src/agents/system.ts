import { SpatialGrid } from '../iso/spatial';
import type { Agent, AgentEnvironment, Neighbor } from './core';
/** Snapshot perception before updates so neighbors do not depend on iteration order. */
export class AgentSystem {
  private grid = new SpatialGrid<Neighbor>(1);
  private neighbors: Neighbor[] = [];
  step(agents: readonly Agent[], dt: number, environment: Omit<AgentEnvironment, 'nearby'>): void {
    this.grid.clear();
    let hasStimuli=false;
    for (const a of agents) if (a.speed !== undefined) {const stimulus=a.stimulus;if(stimulus)hasStimuli=true;this.grid.insert(a.x, a.y, { id: a.id, kind: a.kind, x: a.x, y: a.y, speed: a.speed, heading: a.heading, groupId: a.groupId, juvenile: a.juvenile, alarm: a.alarm, altitude:a.altitude, stimulus:stimulus?{...stimulus}:undefined });}
    const context: AgentEnvironment = { ...environment, hasStimuli, nearby: (x, y, radius) => {
      this.neighbors.length = 0;
      this.grid.visit(x - radius, y - radius, x + radius, y + radius, n => { if ((n.x - x) ** 2 + (n.y - y) ** 2 <= radius ** 2) this.neighbors.push(n); });
      return this.neighbors;
    } };
    for (const agent of agents) agent.update(dt, context);
  }
}
