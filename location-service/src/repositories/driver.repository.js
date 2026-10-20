import { pool } from "../config/database.js";

export async function findDriverById(driverId) {
    const query = `
        SELECT
            id,
            name,
            vehicle_type,
            status,
            created_at,
            updated_at
        FROM drivers
        WHERE id = $1
    `;

    const result = await pool.query(query, [driverId]);

    return result.rows[0] ?? null;
}
export async function createDriver({ name, vehicleType }) {
    const query = `
        INSERT INTO drivers (name, vehicle_type)
        VALUES ($1, $2)
        RETURNING
            id,
            name,
            vehicle_type,
            status,
            created_at,
            updated_at
    `;

    const values = [name, vehicleType];

    const result = await pool.query(query, values);

    return result.rows[0];
}