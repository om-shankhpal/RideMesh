import { pool } from "../config/database.js";

const RIDE_FIELDS = `
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

export async function findAllRides() {
  const query = `
    SELECT ${RIDE_FIELDS}
    FROM rides
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query);
  return result.rows;
}

const allowedPreviousStatuses = {
  IN_PROGRESS: ["MATCHED"],
  COMPLETED: ["IN_PROGRESS"],
  CANCELLED: ["REQUESTED", "MATCHED"],
};

async function rollbackQuietly(client) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("Transaction rollback failed:", rollbackError.message);
  }
}

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
    RETURNING ${RIDE_FIELDS}
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
    SELECT ${RIDE_FIELDS}
    FROM rides
    WHERE id = $1
  `;

  const result = await pool.query(query, [rideId]);
  return result.rows[0] ?? null;
}

export async function updateRideStatus(rideId, newStatus) {
  const previousStatuses = allowedPreviousStatuses[newStatus];

  // MATCHED must only be reached through driver assignment.
  if (!previousStatuses) {
    return null;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the ride to serialize concurrent status transitions.
    const rideResult = await client.query(
      `
        SELECT id, driver_id, status
        FROM rides
        WHERE id = $1
        FOR UPDATE
      `,
      [rideId],
    );

    const currentRide = rideResult.rows[0];

    if (!currentRide) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!previousStatuses.includes(currentRide.status)) {
      await client.query("ROLLBACK");
      return null;
    }

    const updateResult = await client.query(
      `
        UPDATE rides
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING ${RIDE_FIELDS}
      `,
      [rideId, newStatus],
    );

    const updatedRide = updateResult.rows[0];

    // Release an assigned driver when the ride ends or is cancelled.
    const shouldReleaseDriver =
      currentRide.driver_id !== null &&
      ["COMPLETED", "CANCELLED"].includes(newStatus);

    if (shouldReleaseDriver) {
      await client.query(
        `
          INSERT INTO outbox_events (
            event_type,
            aggregate_id,
            payload
          )
          VALUES ($1, $2, $3::jsonb)
        `,
        [
          "DRIVER_STATUS_UPDATE",
          rideId,
          JSON.stringify({
            driverId: currentRide.driver_id,
            status: "AVAILABLE",
          }),
        ],
      );
    }

    await client.query("COMMIT");
    return updatedRide;
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function assignDriverToRide(rideId, driverId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the ride before checking whether it can be assigned.
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

    if (ride.status !== "REQUESTED" || ride.driver_id !== null) {
      await client.query("ROLLBACK");
      return null;
    }

    const updateResult = await client.query(
      `
        UPDATE rides
        SET
          driver_id = $2,
          status = 'MATCHED',
          updated_at = NOW()
        WHERE id = $1
          AND status = 'REQUESTED'
          AND driver_id IS NULL
        RETURNING ${RIDE_FIELDS}
      `,
      [rideId, driverId],
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const assignedRide = updateResult.rows[0];

    // Persist the driver-status event in the same transaction.
    await client.query(
      `
        INSERT INTO outbox_events (
          event_type,
          aggregate_id,
          payload
        )
        VALUES ($1, $2, $3::jsonb)
      `,
      [
        "DRIVER_STATUS_UPDATE",
        assignedRide.id,
        JSON.stringify({
          driverId: assignedRide.driver_id,
          status: "ON_TRIP",
        }),
      ],
    );

    await client.query("COMMIT");
    return assignedRide;
  } catch (error) {
    await rollbackQuietly(client);

    // A unique constraint can reject a conflicting assignment.
    if (error.code === "23505") {
      return null;
    }

    throw error;
  } finally {
    client.release();
  }
}
