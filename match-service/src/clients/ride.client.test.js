import { afterEach, describe, expect, it, vi } from "vitest";

import { assignDriverToRide, getRideById } from "./ride.client.js";

describe("getRideById", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns ride data when Ride Service responds successfully", async () => {
    const mockRide = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "REQUESTED",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockRide }),
      }),
    );

    const result = await getRideById(mockRide.id);

    expect(result).toEqual(mockRide);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3002/rides/${mockRide.id}`,
    );
  });

  it("throws an error when Ride Service returns an unsuccessful status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    await expect(
      getRideById("11111111-1111-4111-8111-111111111111"),
    ).rejects.toMatchObject({
      message: "Failed to retrieve ride",
      status: 404,
    });
  });
});

describe("assignDriverToRide", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("assigns a driver when Ride Service responds successfully", async () => {
    const rideId = "70bfa0a9-6604-4c82-b32f-5cba135d77cf";
    const driverId = "2cbf952d-0851-4367-abd6-e088cd9f398f";

    const mockRide = {
      id: rideId,
      driver_id: driverId,
      status: "MATCHED",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockRide }),
      }),
    );

    const result = await assignDriverToRide(rideId, driverId);

    expect(result).toEqual(mockRide);

    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3002/rides/${rideId}/assign`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ driverId }),
      },
    );
  });

  it("throws an error when driver assignment fails", async () => {
    const rideId = "70bfa0a9-6604-4c82-b32f-5cba135d77cf";
    const driverId = "2cbf952d-0851-4367-abd6-e088cd9f398f";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
      }),
    );

    await expect(assignDriverToRide(rideId, driverId)).rejects.toMatchObject({
      message: "Failed to assign driver",
      status: 409,
    });
  });
});
