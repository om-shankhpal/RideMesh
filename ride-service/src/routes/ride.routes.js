import { Router } from "express";

import {
    createRide,
    findRideById,
} from "../repositories/ride.repository.js";

import { createRideSchema } from "../validation/ride.schema.js";
import { rideIdSchema } from "../validation/ride-id.schema.js";

const router = Router();

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

export default router;