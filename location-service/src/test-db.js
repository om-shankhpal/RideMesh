import { checkDatabaseConnection, pool } from "./config/database.js";

try {
    const result = await checkDatabaseConnection();

    console.log("PostgreSQL connected successfully!");
    console.log("Database:", result.database_name);
    console.log("Server time:", result.current_time);
} catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}