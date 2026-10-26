import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import app from "../server.js";
import { matchRide } from "../services/match.service.js";

vi.mock("../services/match.service.js", () => ({
  matchRide: vi.fn(),
}));

describe("POST /matches/:rideId", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the matched ride when matching succeeds", async () => {
    const rideId = "70bfa0a9-6604-4c82-b32f-5cba135d77cf";

    const matchedRide = {
      id: rideId,
      rider_id: "11111111-1111-4111-8111-111111111111",
      driver_id: "2cbf952d-0851-4367-abd6-e088cd9f398f",
      status: "MATCHED",
    };

    matchRide.mockResolvedValue(matchedRide);

    const response = await request(app).post(`/matches/${rideId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Driver matched successfully",
      data: matchedRide,
    });
    expect(matchRide).toHaveBeenCalledWith(rideId);
  });

  it("returns 400 when the ride ID is invalid", async () => {
    const response = await request(app).post("/matches/not-a-valid-uuid");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid ride ID",
    });
    expect(matchRide).not.toHaveBeenCalled();
  });

  it("returns the error status when matching fails", async () => {
    matchRide.mockRejectedValue(
      Object.assign(new Error("No available drivers could be assigned"), {
        status: 409,
      }),
    );

    const response = await request(app).post(
      "/matches/70bfa0a9-6604-4c82-b32f-5cba135d77cf",
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "No available drivers could be assigned",
    });
  });

  it("returns 500 when an unexpected error has no status", async () => {
    matchRide.mockRejectedValue(new Error("Unexpected failure"));

    const response = await request(app).post(
      "/matches/70bfa0a9-6604-4c82-b32f-5cba135d77cf",
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Unexpected failure",
    });
  });
});
