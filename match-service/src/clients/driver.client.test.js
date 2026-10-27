import { afterEach, describe, expect, it, vi } from "vitest";
import { updateDriverStatus } from "./driver.client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("updateDriverStatus", () => {
  it("should update the driver status successfully", async () => {
    const driver = {
      id: "2cbf952d-0851-4367-abd6-e088cd9f398f",
      name: "Nearby Driver A",
      status: "ON_TRIP",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: driver }),
      }),
    );

    const result = await updateDriverStatus(driver.id, "ON_TRIP");

    expect(result).toEqual(driver);
  });

  it("should send a PATCH request with the requested status", async () => {
    const driverId = "2cbf952d-0851-4367-abd6-e088cd9f398f";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: driverId, status: "ON_TRIP" },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await updateDriverStatus(driverId, "ON_TRIP");

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/drivers/${driverId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "ON_TRIP" }),
      },
    );
  });

  it("should throw an error when the Location Service rejects the update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
      }),
    );

    await expect(
      updateDriverStatus("2cbf952d-0851-4367-abd6-e088cd9f398f", "ON_TRIP"),
    ).rejects.toMatchObject({
      message: "Failed to update driver status",
      status: 409,
    });
  });
});
