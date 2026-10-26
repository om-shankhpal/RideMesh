import { z } from "zod";

export const createRideSchema = z.object({
    riderId: z.string().uuid(),

    pickupLatitude: z.number().min(-90).max(90),
    pickupLongitude: z.number().min(-180).max(180),

    dropoffLatitude: z.number().min(-90).max(90),
    dropoffLongitude: z.number().min(-180).max(180),
});

export const updateRideStatusSchema = z.object({
    status: z.enum([
        "MATCHED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
    ]),
});

export const assignDriverSchema = z.object({
    driverId: z.string().uuid(),
});