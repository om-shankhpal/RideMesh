import { Router } from "express";
import { createDriver } from "../repositories/driver.repository.js";
import { createDriverSchema } from "../validation/driver.schema.js";

const router = Router();

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