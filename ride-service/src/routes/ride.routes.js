import { Router } from "express";

import {
  createRide,
  findRideById,
  findAllRides,
  updateRideStatus,
  assignDriverToRide,
} from "../repositories/ride.repository.js";

import {
  createRideSchema,
  updateRideStatusSchema,
  assignDriverSchema,
} from "../validation/ride.schema.js";
import { rideIdSchema } from "../validation/ride-id.schema.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const rides = await findAllRides();

    return res.status(200).json({
      data: rides,
      count: rides.length,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  const validation = rideIdSchema.safeParse(req.params.id);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid ride ID",
    });
  }

  try {
    const ride = await findRideById(validation.data);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found",
      });
    }

    return res.status(200).json({
      data: ride,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  const validation = createRideSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid ride details",
      details: validation.error.issues,
    });
  }

  try {
    const ride = await createRide(validation.data);

    return res.status(201).json({
      data: ride,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  const idValidation = rideIdSchema.safeParse(req.params.id);

  if (!idValidation.success) {
    return res.status(400).json({
      error: "Invalid ride ID",
    });
  }

  const bodyValidation = updateRideStatusSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return res.status(400).json({
      error: "Invalid ride status",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const ride = await updateRideStatus(
      idValidation.data,
      bodyValidation.data.status,
    );

    if (!ride) {
      const existingRide = await findRideById(idValidation.data);

      if (!existingRide) {
        return res.status(404).json({
          error: "Ride not found",
        });
      }

      return res.status(409).json({
        error: "Invalid ride status transition",
        currentStatus: existingRide.status,
        requestedStatus: bodyValidation.data.status,
      });
    }

    return res.status(200).json({
      data: ride,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/assign", async (req, res, next) => {
  const idValidation = rideIdSchema.safeParse(req.params.id);

  if (!idValidation.success) {
    return res.status(400).json({
      error: "Invalid ride ID",
    });
  }

  const bodyValidation = assignDriverSchema.safeParse(req.body);

  if (!bodyValidation.success) {
    return res.status(400).json({
      error: "Invalid driver details",
      details: bodyValidation.error.issues,
    });
  }

  try {
    const ride = await assignDriverToRide(
      idValidation.data,
      bodyValidation.data.driverId,
    );

    if (!ride) {
      const existingRide = await findRideById(idValidation.data);

      if (!existingRide) {
        return res.status(404).json({
          error: "Ride not found",
        });
      }

      return res.status(409).json({
        error: "Ride cannot be assigned to this driver",
      });
    }

    return res.status(200).json({
      data: ride,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
