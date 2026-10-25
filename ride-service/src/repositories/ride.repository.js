import { pool } from "../config/database.js";

export async function createRide({
    riderId,
    pickupLatitude,
    pickupLongitude,
    dropoffLatitude,
    dropoffLongitude,
}) {
    const query = `
        INSERT INTO rides (
            rider_id,
            pickup_latitude,
            pickup_longitude,
            dropoff_latitude,
            dropoff_longitude
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            rider_id,
            driver_id,
            pickup_latitude,
            pickup_longitude,
            dropoff_latitude,
            dropoff_longitude,
            status,
            created_at,
            updated_at
    `;

    const values = [
        riderId,
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
}

export async function findRideById(rideId) {
    const query = `
        SELECT
            id,
            rider_id,
            driver_id,
            pickup_latitude,
            pickup_longitude,
            dropoff_latitude,
            dropoff_longitude,
            status,
            created_at,
            updated_at
        FROM rides
        WHERE id = $1
    `;

    const result = await pool.query(query, [rideId]);

    return result.rows[0] ?? null;
}

const allowedPreviousStatuses = {
    MATCHED: ["REQUESTED"],
    IN_PROGRESS: ["MATCHED"],
    COMPLETED: ["IN_PROGRESS"],
    CANCELLED: ["REQUESTED", "MATCHED"],
};

export async function updateRideStatus(rideId, newStatus) {
    const previousStatuses = allowedPreviousStatuses[newStatus];

    // This status has no valid incoming transition.
    if (!previousStatuses) {
        return null;
    }

    const query = `
        UPDATE rides
        SET
            status = $2,
            updated_at = NOW()
        WHERE id = $1
          AND status = ANY($3::varchar[])
        RETURNING
            id,
            rider_id,
            driver_id,
            pickup_latitude,
            pickup_longitude,
            dropoff_latitude,
            dropoff_longitude,
            status,
            created_at,
            updated_at
    `;

    const values = [rideId, newStatus, previousStatuses];

    const result = await pool.query(query, values);

    return result.rows[0] ?? null;
}