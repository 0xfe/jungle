import { LandscapePatchAgent } from './patch';
export * from './patch';
import { AgentRegistry } from '../../agents';
import { DeerAgent } from './deer';
import { readPlant, WaterAgent, MoteAgent } from './fixed';
import { ToucanAgent, OrangutanAgent, JaguarAgent } from './wildlife';
import { ECO_CLASSES } from './ecological';
export * from './ecological';
export * from './wildlife';
export * from './deer';
export * from './fixed';
export const jungleAgents = new AgentRegistry(13).register(60,LandscapePatchAgent.read).register(20, DeerAgent.read).register(21, WaterAgent.read).register(22, MoteAgent.read).register(30,ToucanAgent.read).register(31,OrangutanAgent.read).register(32,JaguarAgent.read);
for (let type = 1; type <= 8; type++) jungleAgents.register(type, r => readPlant(type, r));

for(const C of Object.values(ECO_CLASSES)){const a=new C('',0,0,1);jungleAgents.register(a.type,C.read);}
