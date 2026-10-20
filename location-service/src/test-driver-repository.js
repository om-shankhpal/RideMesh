import { randomUUID } from "node:crypto";

import { pool } from "./config/database.js";
import {
  createDriver,
  findDriverById,
} from "./repositories/driver.repository.js";

let createdDriver;

try {
  console.log("Starting driver repository test...\n");

  // 1. Insert a test driver using a parameterized query.
  const createdDriver = await createDriver({
    name: "Test Driver",
    vehicleType: "BIKE",
  });

  console.log("1. Driver created:");
  console.log(createdDriver);

  // 2. Retrieve the driver using our repository function.
  const driver = await findDriverById(createdDriver.id);

  console.log("\n2. Driver retrieved using repository:");
  console.log(driver);

  if (!driver || driver.id !== createdDriver.id) {
    throw new Error("Repository failed to retrieve the test driver.");
  }

  // 3. Search for a UUID that does not exist.
  const missingDriverId = randomUUID();
  const missingDriver = await findDriverById(missingDriverId);

  console.log("\n3. Nonexistent driver lookup:");
  console.log(missingDriver);

  if (missingDriver !== null) {
    throw new Error("Expected null for a nonexistent driver.");
  }

  console.log("\nAll repository checks passed!");
} catch (error) {
  console.error("\nRepository test failed:", error.message);
  process.exitCode = 1;
} finally {
  try {
    if (createdDriver) {
      await pool.query("DELETE FROM drivers WHERE id = $1", [createdDriver.id]);

      console.log("\nTest data cleaned up.");
    }
  } catch (cleanupError) {
    console.error("Failed to clean up test data:", cleanupError.message);

    process.exitCode = 1;
  }

  await pool.end();
}
