import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { InfiniteWorld } from '../src/jungle/infinite';
import { ZenGardenAgent } from '../src/jungle/agents/zen';
import { composeInfinite, cameraBounds } from '../src/jungle/infinite-scene';
import { MemoryRenderer } from '../src/iso/render';
import { bakeZen } from './art/zen';
await mkdir('artifacts',{recursive:true});
const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8')),raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
const w=new InfiniteWorld(2718),site=w.zenLandmark()!;
const view={width:1400,height:1000,pixelRatio:1,zoom:.8,grid:false,cameraX:site.x,cameraY:site.y};w.ensure(cameraBounds(view));
const owner=w.agents.find((a):a is ZenGardenAgent=>a instanceof ZenGardenAgent)!;
const records=[];let tick=0;
for(const seconds of [35,80,140,211]){
 while(tick<seconds*60){w.update(1/60);tick++;}
 renderer.render(composeInfinite(w,atlas,view,.5));
 await sharp(renderer.pixels.data,{raw:{width:view.width,height:view.height,channels:4}}).png().toFile(`artifacts/zen-${seconds}.png`);
 records.push({seconds,residents:owner.residents.map(a=>({kind:a.kind,state:a.state,role:'role' in a?a.role:undefined,x:a.x,y:a.y,visibility:a.visibility}))});
}
await writeFile('artifacts/zen-sequence.json',JSON.stringify({site,records},null,2)+'\n');
// Contact sheets show every artifact separately, before scene occlusion.
const sprites=await bakeZen(),contacts:sharp.OverlayOptions[]=[];
const selected=sprites.filter(s=>/zen-pagoda|zen-tree|zen-lotus|-(0|2|4|6)$/.test(s.id));
for(const [i,s] of selected.entries()){
 const f=s.frames[Math.floor(s.frames.length/3)]!,scale=s.id.includes('pagoda')?1:s.id.includes('tree')?1.4:3;
 const png=await sharp(f.data,{raw:{width:f.width,height:f.height,channels:4}}).resize(Math.round(f.width*scale),Math.round(f.height*scale),{kernel:'nearest'}).png().toBuffer();
 contacts.push({input:png,left:i%8*200+5,top:Math.floor(i/8)*290+5});
}
await sharp({create:{width:1600,height:Math.ceil(selected.length/8)*290+70,channels:4,background:'#314c44'}}).composite(contacts).png().toFile('artifacts/zen-artifacts.png');
console.log('Sanctuary scene sequence and individual contact sheet → artifacts/zen-*.png',site);
// A real controller traversal at close range: no hand-posed monk positions.
const passage=ZenGardenAgent.create(site,w.settings),monk=passage.residents.find(a=>a.kind==='monk')!;
passage.residents=[monk];monk.timer=0;
w.agents=w.agents.filter(a=>a.id!==passage.id);w.agents.push(passage);
const entrance=(await import('../src/jungle/zen-sites')).zenLayout(site);
const close={...view,width:640,height:400,zoom:1.7,cameraX:entrance.steps.x,cameraY:entrance.steps.y};
const env={time:0,canMove:()=>true,nearby:()=>[],sample:(x:number,y:number)=>({water:w.tileAt(x,y)!.materialAt(x,y)>=4,elevation:w.heightAt(x,y),wind:1,light:1,moisture:.5})};
const saved=new Set<string>();
for(let i=0;i<300*60&&saved.size<4;i++){
 passage.update(1/60,env);
 const lift='lift' in monk?Number(monk.lift):0;
 const shot=monk.state===1&&monk.visibility>.25&&monk.visibility<.65?'exit-door':monk.state===1&&lift>7&&lift<11?'down-stairs':monk.state===5&&lift>7&&lift<11?'up-stairs':monk.state===5&&monk.visibility>.25&&monk.visibility<.65?'enter-door':undefined;
 if(!shot||saved.has(shot))continue;saved.add(shot);
 renderer.render(composeInfinite(w,atlas,close,.5));
 await sharp(renderer.pixels.data,{raw:{width:close.width,height:close.height,channels:4}}).png().toFile(`artifacts/zen-${shot}.png`);
}
if(saved.size!==4)throw new Error('Monk preview did not complete both stair and doorway transitions');
