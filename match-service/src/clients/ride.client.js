const RIDE_SERVICE_URL =
  process.env.RIDE_SERVICE_URL || "http://localhost:3002";

export async function getRideById(rideId) {
  const response = await fetch(`${RIDE_SERVICE_URL}/rides/${rideId}`);

  if (!response.ok) {
    const error = new Error("Failed to retrieve ride");
    error.status = response.status;
    throw error;
  }

  const result = await response.json();

  return result.data;
}

export async function assignDriverToRide(rideId, driverId) {
  const response = await fetch(`${RIDE_SERVICE_URL}/rides/${rideId}/assign`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ driverId }),
  });

  if (!response.ok) {
    const error = new Error("Failed to assign driver");
    error.status = response.status;
    throw error;
  }

  const result = await response.json();

  return result.data;
}
