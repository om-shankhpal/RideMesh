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

export async function assignDriverToRide(rideId, driverId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the ride so concurrent requests cannot modify
    // this ride simultaneously.
    const rideResult = await client.query(
      `
                SELECT id, driver_id, status
                FROM rides
                WHERE id = $1
                FOR UPDATE
            `,
      [rideId],
    );

    const ride = rideResult.rows[0];

    if (!ride) {
      await client.query("ROLLBACK");
      return null;
    }

    // Only unassigned rides awaiting a driver can be matched.
    if (ride.status !== "REQUESTED" || ride.driver_id !== null) {
      await client.query("ROLLBACK");
      return null;
    }

    const updateQuery = `
            UPDATE rides
            SET
                driver_id = $2,
                status = 'MATCHED',
                updated_at = NOW()
            WHERE id = $1
              AND status = 'REQUESTED'
              AND driver_id IS NULL
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

    const result = await client.query(updateQuery, [rideId, driverId]);

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    // PostgreSQL unique-constraint violation.
    if (error.code === "23505") {
      return null;
    }

    throw error;
  } finally {
    client.release();
  }
}
