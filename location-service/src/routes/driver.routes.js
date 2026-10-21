import { Router } from "express";
import {
  createDriver,
  findDriverById,
} from "../repositories/driver.repository.js";
import { createDriverSchema } from "../validation/driver.schema.js";
import { driverIdSchema } from "../validation/driver-id.schema.js";

const router = Router();

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

  return res.status(200).json({
    data: driver,
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

export default router;
