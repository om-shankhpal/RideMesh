import { z } from "zod";

export const updateDriverSchema = z.object({
  name: z.string().trim().min(2).max(100),
  vehicleType: z.enum(["BIKE", "CAR"]),
});