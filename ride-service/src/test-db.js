import "dotenv/config";

import { checkDatabaseConnection, pool } from "./config/database.js";

try {
    const result = await checkDatabaseConnection();

    console.log("Database connection successful!");
    console.log("Database:", result.database_name);
    console.log("Current time:", result.current_time);
} catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}