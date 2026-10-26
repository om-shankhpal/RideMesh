import { Router } from "express";
import { z } from "zod";

import { matchRide } from "../services/match.service.js";

const router = Router();

const rideIdSchema = z.string().uuid();

router.post("/:rideId", async (req, res) => {
  const validation = rideIdSchema.safeParse(req.params.rideId);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid ride ID",
    });
  }

  try {
    const matchedRide = await matchRide(validation.data);

    return res.status(200).json({
      message: "Driver matched successfully",
      data: matchedRide,
    });
  } catch (error) {
    const status = error.status || 500;

    return res.status(status).json({
      error: error.message || "Internal server error",
    });
  }
});

export default router;
