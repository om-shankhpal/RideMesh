const LOCATION_SERVICE_URL =
  process.env.LOCATION_SERVICE_URL || "http://localhost:3001";

export async function updateDriverStatus(driverId, status) {
  const response = await fetch(
    `${LOCATION_SERVICE_URL}/drivers/${driverId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    const error = new Error("Failed to update driver status");
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  return result.data;
}
