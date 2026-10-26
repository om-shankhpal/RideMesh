import { afterEach, describe, expect, it, vi } from "vitest";

import { getNearbyDrivers } from "./location.client.js";

describe("getNearbyDrivers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns nearby drivers when Location Service responds successfully", async () => {
    const mockDrivers = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Driver One",
        status: "AVAILABLE",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Driver Two",
        status: "AVAILABLE",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockDrivers,
          count: mockDrivers.length,
        }),
      }),
    );

    const result = await getNearbyDrivers({
      latitude: 19.076,
      longitude: 72.8777,
    });

    expect(result).toEqual(mockDrivers);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/drivers/nearby?latitude=19.076&longitude=72.8777&radius=3000",
    );
  });

  it("throws an error when Location Service responds unsuccessfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(
      getNearbyDrivers({
        latitude: 19.076,
        longitude: 72.8777,
      }),
    ).rejects.toMatchObject({
      message: "Failed to retrieve nearby drivers",
      status: 500,
    });
  });
});
