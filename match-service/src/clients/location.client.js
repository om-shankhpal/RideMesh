const LOCATION_SERVICE_URL =
  process.env.LOCATION_SERVICE_URL || "http://localhost:3001";

export async function getNearbyDrivers({ latitude, longitude, radius = 3000 }) {
  const queryParams = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radius: String(radius),
  });

  const response = await fetch(
    `${LOCATION_SERVICE_URL}/drivers/nearby?${queryParams}`,
  );

  if (!response.ok) {
    const error = new Error("Failed to retrieve nearby drivers");
    error.status = response.status;
    throw error;
  }

  const result = await response.json();

  return result.data;
}
