import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "./server.js";
import { pool } from "./config/database.js";
import {
  createRide,
  updateRideStatus,
} from "./repositories/ride.repository.js";

describe("POST /rides", () => {
  it("creates a ride with valid input", async () => {
    let rideId;

    try {
      const response = await request(app).post("/rides").send({
        riderId: "11111111-1111-4111-8111-111111111111",
        pickupLatitude: 19.076,
        pickupLongitude: 72.8777,
        dropoffLatitude: 19.1,
        dropoffLongitude: 72.9,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe("REQUESTED");
      expect(response.body.data.driver_id).toBeNull();

      rideId = response.body.data.id;
    } finally {
      if (rideId) {
        await pool.query("DELETE FROM rides WHERE id = $1", [rideId]);
      }
    }
  });

  it("rejects invalid coordinates", async () => {
    const response = await request(app).post("/rides").send({
      riderId: "11111111-1111-4111-8111-111111111111",
      pickupLatitude: 150,
      pickupLongitude: 72.8777,
      dropoffLatitude: 19.1,
      dropoffLongitude: 72.9,
    });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid rider ID", async () => {
    const response = await request(app).post("/rides").send({
      riderId: "not-a-uuid",
      pickupLatitude: 19.076,
      pickupLongitude: 72.8777,
      dropoffLatitude: 19.1,
      dropoffLongitude: 72.9,
    });

    expect(response.status).toBe(400);
  });
});
describe("GET /rides/:id", () => {
  it("returns an existing ride", async () => {
    let ride;

    try {
      ride = await createRide({
        riderId: "11111111-1111-4111-8111-111111111111",
        pickupLatitude: 19.076,
        pickupLongitude: 72.8777,
        dropoffLatitude: 19.1,
        dropoffLongitude: 72.9,
      });

      const response = await request(app).get(`/rides/${ride.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(ride.id);
      expect(response.body.data.status).toBe("REQUESTED");
    } finally {
      if (ride) {
        await pool.query("DELETE FROM rides WHERE id = $1", [ride.id]);
      }
    }
  });

  it("returns 404 when the ride does not exist", async () => {
    const response = await request(app).get(
      "/rides/22222222-2222-4222-8222-222222222222",
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Ride not found");
  });

  it("returns 400 when the ride ID is invalid", async () => {
    const response = await request(app).get("/rides/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid ride ID");
  });
});

describe("PATCH /rides/:id/status", () => {
  const rideDetails = {
    riderId: "11111111-1111-4111-8111-111111111111",
    pickupLatitude: 19.076,
    pickupLongitude: 72.8777,
    dropoffLatitude: 19.1,
    dropoffLongitude: 72.9,
  };

  async function createTestRide() {
    return createRide(rideDetails);
  }

  it("transitions a ride from REQUESTED to MATCHED", async () => {
    let ride;

    try {
      ride = await createTestRide();

      const response = await request(app)
        .patch(`/rides/${ride.id}/status`)
        .send({ status: "MATCHED" });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("MATCHED");
    } finally {
      if (ride) {
        await pool.query("DELETE FROM rides WHERE id = $1", [ride.id]);
      }
    }
  });

  it("rejects an invalid status transition", async () => {
    let ride;

    try {
      ride = await createTestRide();

      const response = await request(app)
        .patch(`/rides/${ride.id}/status`)
        .send({ status: "COMPLETED" });

      expect(response.status).toBe(409);
      expect(response.body.currentStatus).toBe("REQUESTED");
      expect(response.body.requestedStatus).toBe("COMPLETED");
    } finally {
      if (ride) {
        await pool.query("DELETE FROM rides WHERE id = $1", [ride.id]);
      }
    }
  });

  it("rejects an unsupported status", async () => {
    let ride;

    try {
      ride = await createTestRide();

      const response = await request(app)
        .patch(`/rides/${ride.id}/status`)
        .send({ status: "FLYING" });

      expect(response.status).toBe(400);
    } finally {
      if (ride) {
        await pool.query("DELETE FROM rides WHERE id = $1", [ride.id]);
      }
    }
  });

  it("returns 404 when the ride does not exist", async () => {
    const response = await request(app)
      .patch("/rides/22222222-2222-4222-8222-222222222222/status")
      .send({ status: "MATCHED" });

    expect(response.status).toBe(404);
  });
});

afterAll(async () => {
  await pool.end();
});
