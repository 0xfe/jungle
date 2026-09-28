import { hash, noise } from '../iso/math';
/** Shared atlas forms: original + two older silhouettes + new structural views. */
export const TREE_FORMS = [7, 5, 5, 5] as const;
export const PLANT_FORMS = [3, 3, 3, 1] as const;
export interface PlantAppearance { width: number; height: number; lean: number; mirror: boolean; tone: number; vine: number }
/** A compact genotype, expanded once per plant; no per-frame randomness or textures. */
export function plantAppearance(gene: number): Readonly<PlantAppearance> {
  return Object.freeze({ width: .88 + (gene & 15) / 15 * .24,
    height: .93 + (gene >>> 4 & 15) / 15 * .14,
    lean: ((gene >>> 8 & 15) / 15 - .5) * .035,
    mirror: !!(gene & 4096), tone: (gene >>> 13 & 3) === 3 ? 1 : 0,
    vine: gene & 32768 && (gene & 7) < 2 ? (gene >>> 4 & 3) + 1 : 0 });
}
export function plantGene(x: number, y: number, seed: number): number { return Math.floor(hash(Math.floor(x * 4096), Math.floor(y * 4096), seed + 382) * 65536); }
/** Continuous habitat patches: broad stands, openings, and smaller understory colonies. */
export function vegetationPatch(x: number, y: number, seed: number) {
  const canopy = noise(x / 3.8, y / 3.8, seed + 791);
  return { canopy: .2 + canopy * 1.05, understory: .25 + noise(x / 1.8, y / 1.8, seed + 721) * .9,
    fern: noise(x / 2.5, y / 2.5, seed + 661) };
}
