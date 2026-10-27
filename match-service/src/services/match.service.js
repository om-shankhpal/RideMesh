import { getNearbyDrivers } from "../clients/location.client.js";
import { assignDriverToRide, getRideById } from "../clients/ride.client.js";
import { updateDriverStatus } from "../clients/driver.client.js";

export async function matchRide(rideId) {
  const ride = await getRideById(rideId);

  if (ride.status !== "REQUESTED") {
    const error = new Error("Ride is not available for matching");
    error.status = 409;
    throw error;
  }

  const drivers = await getNearbyDrivers({
    latitude: ride.pickup_latitude,
    longitude: ride.pickup_longitude,
  });

  for (const driver of drivers) {
    try {
      const matchedRide = await assignDriverToRide(rideId, driver.id);

      try {
        await updateDriverStatus(driver.id, "ON_TRIP");
      } catch (error) {
        console.error(
          `Ride ${rideId} was matched, but driver ${driver.id} status synchronization failed:`,
          error.message,
        );
      }

      return matchedRide;
    } catch (error) {
      if (error.status === 409) {
        continue;
      }

      throw error;
    }
  }

  const error = new Error("No available drivers could be assigned");
  error.status = 409;
  throw error;
}
