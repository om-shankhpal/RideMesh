import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "./server.js";
import { pool } from "./config/database.js";
import {
  createRide,
  updateRideStatus,
  assignDriverToRide,
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

describe("assignDriverToRide", () => {
  const rideDetails = {
    riderId: "11111111-1111-4111-8111-111111111111",
    pickupLatitude: 19.076,
    pickupLongitude: 72.8777,
    dropoffLatitude: 19.1,
    dropoffLongitude: 72.9,
  };

  it("assigns a driver and changes the ride to MATCHED", async () => {
    let ride;

    try {
      ride = await createRide(rideDetails);

      const driverId = "33333333-3333-4333-8333-333333333333";

      const assignedRide = await assignDriverToRide(ride.id, driverId);

      expect(assignedRide).not.toBeNull();
      expect(assignedRide.driver_id).toBe(driverId);
      expect(assignedRide.status).toBe("MATCHED");
    } finally {
      if (ride) {
        await pool.query("DELETE FROM rides WHERE id = $1", [ride.id]);
      }
    }
  });

  it("does not assign a driver to a ride that is already matched", async () => {
    let ride;

    try {
      ride = await createRide(rideDetails);

      const firstDriverId = "33333333-3333-4333-8333-333333333333";
      const secondDriverId = "44444444-4444-4444-8444-444444444444";

      const firstAssignment = await assignDriverToRide(ride.id, firstDriverId);

      const secondAssignment = await assignDriverToRide(
        ride.id,
        secondDriverId,
      );

      expect(firstAssignment.driver_id).toBe(firstDriverId);
      expect(secondAssignment).toBeNull();
    } finally {
      if (ride) {
        await pool.query("DELETE FROM rides WHERE id = $1", [ride.id]);
      }
    }
  });

  it("returns null when the ride does not exist", async () => {
    const result = await assignDriverToRide(
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(result).toBeNull();
  });

  it("prevents two rides from claiming the same driver concurrently", async () => {
    let ride1;
    let ride2;

    const driverId = "33333333-3333-4333-8333-333333333333";

    const rideDetails = {
      riderId: "11111111-1111-4111-8111-111111111111",
      pickupLatitude: 19.076,
      pickupLongitude: 72.8777,
      dropoffLatitude: 19.1,
      dropoffLongitude: 72.9,
    };

    try {
      ride1 = await createRide(rideDetails);
      ride2 = await createRide(rideDetails);

      const results = await Promise.all([
        assignDriverToRide(ride1.id, driverId),
        assignDriverToRide(ride2.id, driverId),
      ]);

      const successfulAssignments = results.filter((result) => result !== null);

      expect(successfulAssignments).toHaveLength(1);

      const databaseResult = await pool.query(
        `
                SELECT COUNT(*)::int AS count
                FROM rides
                WHERE driver_id = $1
                  AND status IN ('MATCHED', 'IN_PROGRESS')
            `,
        [driverId],
      );

      expect(databaseResult.rows[0].count).toBe(1);
    } finally {
      const rideIds = [ride1?.id, ride2?.id].filter(Boolean);

      if (rideIds.length > 0) {
        await pool.query("DELETE FROM rides WHERE id = ANY($1::uuid[])", [
          rideIds,
        ]);
      }
    }
  });
});

afterAll(async () => {
  await pool.end();
});
