/** Generation multipliers, grouped for the hidden world editor. Zero removes a kind.
 * Values affect seeded admission, never simulation speed or per-frame randomness. */
export const ARTIFACT_GROUPS = {
  Landmarks: ['pagoda','volcano','saucer','lander','scout'],
  Gardens: ['zenTree','zenFlowers','lotus','monk','koi','duck','pelican'],
  Vegetation: ['grove','bloom','fruit','bush','grass','wet','waterPlants','flowers','mud','accents'],
  Mammals: ['tiger','hippo','bison','deer','zebra','giraffe','elephant','orangutan','monkey','squirrel','beaver','boar','blackBear','wolf','jaguar'],
  Birds: ['toucan','macaw','parakeet','kingfisher','seagull','hawk','vulture'],
  'Water & reptiles': ['fish','whale','crocodile','toad','boa','smallSnake'],
} as const;
export type ArtifactKind = typeof ARTIFACT_GROUPS[keyof typeof ARTIFACT_GROUPS][number];
export type ArtifactKey = `chance_${ArtifactKind}`;
export const ARTIFACT_KINDS = Object.values(ARTIFACT_GROUPS).flat() as ArtifactKind[];
export const ARTIFACT_DEFAULTS = Object.fromEntries(ARTIFACT_KINDS.map(k=>[`chance_${k}`,1])) as Record<ArtifactKey,number>;
export const artifactLabel=(s:string)=>s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
