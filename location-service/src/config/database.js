import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error.message);
});

export async function checkDatabaseConnection() {
    const query = `
        SELECT
            NOW() AS current_time,
            current_database() AS database_name
    `;

    const result = await pool.query(query);

    return result.rows[0];
}