import { z } from "zod";

export const driverIdSchema = z.string().uuid();