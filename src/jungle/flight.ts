import type { FlightProfile } from '../agents/flight';
export const BIRD_FLIGHT:Readonly<Record<string,FlightProfile>>={
 hawk:{beats:2.5,burst:1.0,glide:5.5},vulture:{beats:2.0,burst:1.2,glide:4.5},
 seagull:{beats:4.2,burst:.8,glide:1.6},toucan:{beats:5.8,burst:1.2,glide:.45},
 macaw:{beats:4.6,burst:1.15,glide:.7},parakeet:{beats:7.2,burst:.9,glide:.3},kingfisher:{beats:7.8,burst:1.1,glide:.35},
};
