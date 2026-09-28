import type { FlightProfile } from '../agents/flight';
export const BIRD_FLIGHT:Readonly<Record<string,FlightProfile>>={
 seagull:{beats:4.2,burst:.8,glide:1.6},toucan:{beats:5.8,burst:1.2,glide:.45},
 macaw:{beats:4.6,burst:1.15,glide:.7},parakeet:{beats:7.2,burst:.9,glide:.3},kingfisher:{beats:7.8,burst:1.1,glide:.35},
};
