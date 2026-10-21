import { z } from "zod";

export const driverStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "ON_TRIP", "OFFLINE"]),
});
