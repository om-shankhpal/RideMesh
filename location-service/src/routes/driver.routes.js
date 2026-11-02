import { Router } from "express";
import {
  createDriver,
  findDriverById,
  findAllDrivers,
  updateDriverStatus,
  updateDriverDetails,
  findAvailableDriversByIds,
} from "../repositories/driver.repository.js";
import { createDriverSchema } from "../validation/driver.schema.js";
import { driverIdSchema } from "../validation/driver-id.schema.js";
import { driverStatusSchema } from "../validation/driver-status.schema.js";
import { driverLocationSchema } from "../validation/driver-location.schema.js";
import {
  saveDriverLocation,
  findNearbyDriverIds,
  getDriverLocation,
  getDriversLocations,
} from "../repositories/driver-location.repository.js";
import { nearbyDriversSchema } from "../validation/nearby-drivers.schema.js";
import { updateDriverSchema } from "../validation/driver-update.schema.js";

const router = Router();

// GET /drivers — list all drivers with optional location data from Redis
router.get("/", async (req, res) => {
  const drivers = await findAllDrivers();
  const driverIds = drivers.map((d) => d.id);
  const locations = await getDriversLocations(driverIds);

  const enrichedDrivers = drivers.map((driver) => ({
    ...driver,
    location: locations[driver.id] ?? null,
  }));

  return res.status(200).json({
    data: enrichedDrivers,
    count: enrichedDrivers.length,
  });
});

router.post("/", async (req, res) => {
  const validation = createDriverSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const driver = await createDriver(validation.data);

  return res.status(201).json({ data: driver });
});

// GET /drivers/nearby — find nearby available drivers
router.get("/nearby", async (req, res) => {
  const validation = nearbyDriversSchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid nearby-driver search parameters",
      details: validation.error.issues,
    });
  }

  const { latitude, longitude, radius } = validation.data;

  const nearbyDriverIds = await findNearbyDriverIds({
    latitude,
    longitude,
    radius,
  });

  if (nearbyDriverIds.length === 0) {
    return res.status(200).json({
      data: [],
      count: 0,
    });
  }

  const availableDrivers = await findAvailableDriversByIds(nearbyDriverIds);

  return res.status(200).json({
    data: availableDrivers,
    count: availableDrivers.length,
  });
});

// PATCH /drivers/:id — update driver details
router.patch("/:id", async (req, res) => {
  const idValidation = driverIdSchema.safeParse(req.params.id);

  if (!idValidation.success) {
    return res.status(400).json({
      error: "Invalid driver ID",
    });
  }

  const validation = updateDriverSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const driver = await updateDriverDetails(idValidation.data, validation.data);

  if (!driver) {
    return res.status(404).json({
      error: "Driver not found",
    });
  }

  return res.status(200).json({
    message: "Driver details updated successfully",
    data: driver,
  });
});

router.patch("/:id/status", async (req, res) => {
  const idValidation = driverIdSchema.safeParse(req.params.id);

  if (!idValidation.success) {
    return res.status(400).json({
      error: "Invalid driver ID",
    });
  }

  const statusValidation = driverStatusSchema.safeParse(req.body);

  if (!statusValidation.success) {
    return res.status(400).json({
      error: "Invalid driver status",
      details: statusValidation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const result = await updateDriverStatus(
    idValidation.data,
    statusValidation.data.status,
  );

  if (result.type === "not_found") {
    return res.status(404).json({
      error: "Driver not found",
    });
  }

  if (result.type === "invalid_transition") {
    return res.status(409).json({
      error: "Invalid driver status transition",
      currentStatus: result.currentStatus,
      requestedStatus: statusValidation.data.status,
    });
  }

  return res.status(200).json({
    data: result.driver,
  });
});

// GET /drivers/:id/location — get driver location
router.get("/:id/location", async (req, res) => {
  const idValidation = driverIdSchema.safeParse(req.params.id);

  if (!idValidation.success) {
    return res.status(400).json({
      error: "Invalid driver ID",
    });
  }

  const driver = await findDriverById(idValidation.data);

  if (!driver) {
    return res.status(404).json({
      error: "Driver not found",
    });
  }

  const location = await getDriverLocation(driver.id);

  if (!location) {
    return res.status(404).json({
      error: "Driver location not found",
    });
  }

  return res.status(200).json({
    data: {
      driverId: driver.id,
      ...location,
    },
  });
});

// PATCH /drivers/:id/location — update driver location
router.patch("/:id/location", async (req, res) => {
  const idValidation = driverIdSchema.safeParse(req.params.id);

  if (!idValidation.success) {
    return res.status(400).json({
      error: "Invalid driver ID",
    });
  }

  const locationValidation = driverLocationSchema.safeParse(req.body);

  if (!locationValidation.success) {
    return res.status(400).json({
      error: "Invalid location coordinates",
      details: locationValidation.error.issues,
    });
  }

  const driver = await findDriverById(idValidation.data);

  if (!driver) {
    return res.status(404).json({
      error: "Driver not found",
    });
  }

  await saveDriverLocation(driver.id, locationValidation.data);

  return res.status(200).json({
    message: "Driver location updated successfully",
    data: {
      driverId: driver.id,
      latitude: locationValidation.data.latitude,
      longitude: locationValidation.data.longitude,
    },
  });
});

// GET /drivers/:id — retrieve single driver details with location
router.get("/:id", async (req, res) => {
  const validation = driverIdSchema.safeParse(req.params.id);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid driver ID",
    });
  }

  const driver = await findDriverById(validation.data);

  if (!driver) {
    return res.status(404).json({
      error: "Driver not found",
    });
  }

  const location = await getDriverLocation(driver.id);

  return res.status(200).json({
    data: {
      ...driver,
      location,
    },
  });
});

export default router;
