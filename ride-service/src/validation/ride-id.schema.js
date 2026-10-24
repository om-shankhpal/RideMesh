import { z } from "zod";

export const rideIdSchema = z.string().uuid();