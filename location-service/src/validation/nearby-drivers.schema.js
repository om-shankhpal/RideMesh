import { z } from "zod";

export const nearbyDriversSchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().int().positive().max(50000).default(3000),
});