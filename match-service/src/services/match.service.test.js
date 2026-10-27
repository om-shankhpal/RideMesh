import { afterEach, describe, expect, it, vi } from "vitest";

import { getNearbyDrivers } from "../clients/location.client.js";
import { assignDriverToRide, getRideById } from "../clients/ride.client.js";
import { matchRide } from "./match.service.js";

vi.mock("../clients/location.client.js", () => ({
  getNearbyDrivers: vi.fn(),
}));

vi.mock("../clients/ride.client.js", () => ({
  assignDriverToRide: vi.fn(),
  getRideById: vi.fn(),
}));

describe("matchRide", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("assigns the first available candidate", async () => {
    const rideId = "70bfa0a9-6604-4c82-b32f-5cba135d77cf";
    const driverId = "2cbf952d-0851-4367-abd6-e088cd9f398f";

    const mockRide = {
      id: rideId,
      pickup_latitude: 19.076,
      pickup_longitude: 72.8777,
      status: "REQUESTED",
    };

    const mockMatchedRide = {
      ...mockRide,
      driver_id: driverId,
      status: "MATCHED",
    };

    getRideById.mockResolvedValue(mockRide);
    getNearbyDrivers.mockResolvedValue([{ id: driverId, status: "AVAILABLE" }]);
    assignDriverToRide.mockResolvedValue(mockMatchedRide);

    const result = await matchRide(rideId);

    expect(result).toEqual(mockMatchedRide);

    expect(getRideById).toHaveBeenCalledWith(rideId);

    expect(getNearbyDrivers).toHaveBeenCalledWith({
      latitude: 19.076,
      longitude: 72.8777,
    });

    expect(assignDriverToRide).toHaveBeenCalledWith(rideId, driverId);
    expect(assignDriverToRide).toHaveBeenCalledTimes(1);
  });

  it("rejects rides that are not REQUESTED", async () => {
    getRideById.mockResolvedValue({
      id: "70bfa0a9-6604-4c82-b32f-5cba135d77cf",
      status: "MATCHED",
    });

    await expect(
      matchRide("70bfa0a9-6604-4c82-b32f-5cba135d77cf"),
    ).rejects.toMatchObject({
      message: "Ride is not available for matching",
      status: 409,
    });

    expect(getNearbyDrivers).not.toHaveBeenCalled();
    expect(assignDriverToRide).not.toHaveBeenCalled();
  });

  it("tries the next driver when an assignment conflicts", async () => {
    const rideId = "70bfa0a9-6604-4c82-b32f-5cba135d77cf";
    const firstDriverId = "2cbf952d-0851-4367-abd6-e088cd9f398f";
    const secondDriverId = "3cbf952d-0851-4367-abd6-e088cd9f398f";

    getRideById.mockResolvedValue({
      id: rideId,
      pickup_latitude: 19.076,
      pickup_longitude: 72.8777,
      status: "REQUESTED",
    });

    getNearbyDrivers.mockResolvedValue([
      { id: firstDriverId },
      { id: secondDriverId },
    ]);

    assignDriverToRide
      .mockRejectedValueOnce(
        Object.assign(new Error("Assignment conflict"), {
          status: 409,
        }),
      )
      .mockResolvedValueOnce({
        id: rideId,
        driver_id: secondDriverId,
        status: "MATCHED",
      });

    const result = await matchRide(rideId);

    expect(result.driver_id).toBe(secondDriverId);
    expect(assignDriverToRide).toHaveBeenCalledTimes(2);

    expect(assignDriverToRide).toHaveBeenNthCalledWith(
      1,
      rideId,
      firstDriverId,
    );

    expect(assignDriverToRide).toHaveBeenNthCalledWith(
      2,
      rideId,
      secondDriverId,
    );
  });

  it("fails when no nearby drivers are available", async () => {
    getRideById.mockResolvedValue({
      id: "70bfa0a9-6604-4c82-b32f-5cba135d77cf",
      pickup_latitude: 19.076,
      pickup_longitude: 72.8777,
      status: "REQUESTED",
    });

    getNearbyDrivers.mockResolvedValue([]);

    await expect(
      matchRide("70bfa0a9-6604-4c82-b32f-5cba135d77cf"),
    ).rejects.toMatchObject({
      message: "No available drivers could be assigned",
      status: 409,
    });

    expect(assignDriverToRide).not.toHaveBeenCalled();
  });

  it("propagates unexpected assignment errors", async () => {
    const rideId = "70bfa0a9-6604-4c82-b32f-5cba135d77cf";
    const driverId = "2cbf952d-0851-4367-abd6-e088cd9f398f";

    getRideById.mockResolvedValue({
      id: rideId,
      pickup_latitude: 19.076,
      pickup_longitude: 72.8777,
      status: "REQUESTED",
    });

    getNearbyDrivers.mockResolvedValue([{ id: driverId }]);

    assignDriverToRide.mockRejectedValue(
      Object.assign(new Error("Ride Service unavailable"), {
        status: 503,
      }),
    );

    await expect(matchRide(rideId)).rejects.toMatchObject({
      message: "Ride Service unavailable",
      status: 503,
    });
  });
});
