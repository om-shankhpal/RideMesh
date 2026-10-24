import "dotenv/config";

import { createRide } from "./repositories/ride.repository.js";
import { pool } from "./config/database.js";

let createdRide;

try {
    createdRide = await createRide({
        riderId: "11111111-1111-4111-8111-111111111111",
        pickupLatitude: 19.076,
        pickupLongitude: 72.8777,
        dropoffLatitude: 19.1,
        dropoffLongitude: 72.9,
    });

    console.log("Ride created successfully!");
    console.log(createdRide);
} catch (error) {
    console.error("Ride creation failed:", error.message);
    process.exitCode = 1;
} finally {
    if (createdRide) {
        await pool.query(
            "DELETE FROM rides WHERE id = $1",
            [createdRide.id],
        );

        console.log("Test ride cleaned up.");
    }

    await pool.end();
}