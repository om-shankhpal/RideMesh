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

export async function findAllDrivers() {
  const query = `
    SELECT
      id,
      name,
      vehicle_type,
      status,
      created_at,
      updated_at
    FROM drivers
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query);

  return result.rows;
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

export async function updateDriverStatus(driverId, status) {
  const query = `
    UPDATE drivers
    SET
      status = $1,
      updated_at = NOW()
    WHERE id = $2
      AND (
        (status = 'OFFLINE' AND $1 = 'AVAILABLE')
        OR (status = 'AVAILABLE' AND $1 = 'ON_TRIP')
        OR (status = 'ON_TRIP' AND $1 = 'AVAILABLE')
        OR (status = 'AVAILABLE' AND $1 = 'OFFLINE')
      )
    RETURNING
      id,
      name,
      vehicle_type,
      status,
      created_at,
      updated_at
  `;

  const values = [status, driverId];

  const result = await pool.query(query, values);

  if (result.rows[0]) {
    return { type: "updated", driver: result.rows[0] };
  }

  const existingDriver = await findDriverById(driverId);

  if (!existingDriver) {
    return { type: "not_found" };
  }

  return {
    type: "invalid_transition",
    currentStatus: existingDriver.status,
  };
}

export async function findAvailableDriversByIds(driverIds) {
  if (driverIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      id,
      name,
      vehicle_type,
      status
    FROM drivers
    WHERE id = ANY($1::uuid[])
      AND status = 'AVAILABLE'
  `;

  const result = await pool.query(query, [driverIds]);

  const driversById = new Map(
    result.rows.map((driver) => [driver.id, driver]),
  );

  return driverIds
    .map((driverId) => driversById.get(driverId))
    .filter(Boolean);
}

export async function updateDriverDetails(
  driverId,
  { name, vehicleType },
) {
  const query = `
    UPDATE drivers
    SET
      name = $1,
      vehicle_type = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING
      id,
      name,
      vehicle_type,
      status,
      created_at,
      updated_at
  `;

  const values = [name, vehicleType, driverId];

  const result = await pool.query(query, values);

  return result.rows[0] ?? null;
}