/** Lossless delivery encoding. The inspectable baker manifest remains ordinary JSON. */
export function packRuntimeAtlas(atlas) {
  const {sprites,animalClips,spacecraftParts,zenParts,...meta}=atlas;
  const names=Object.keys(sprites),ids=new Map(names.map((name,i)=>[name,i]));
  const regions=[],regionIds=new Map();
  const records=names.map(name=>{
    const s=sprites[name];
    const frames=s.frames.map(r=>{
      const key=`${r.x},${r.y},${r.width},${r.height}`;
      let id=regionIds.get(key);
      if(id===undefined){id=regions.length/4;regionIds.set(key,id);regions.push(r.x,r.y,r.width,r.height);}
      return id;
    });
    return [name,s.width,s.height,...s.anchor,frames,...(s.frameIndices?[s.frameIndices]:[])];
  });
  const parts=entries=>entries?Object.entries(entries).map(([name,list])=>[name,list.map(part=>{
    const id=ids.get(part);if(id===undefined)throw new Error(`Unregistered atlas part: ${part}`);return id;
  })]):undefined;
  return {format:'jungle-atlas-1',meta,regions,sprites:records,
    animals:animalClips?Object.entries(animalClips).map(([name,c])=>[name,c.frames,parts({[name]:c.parts})[0][1]]):undefined,
    ships:parts(spacecraftParts),zen:parts(zenParts)};
}
