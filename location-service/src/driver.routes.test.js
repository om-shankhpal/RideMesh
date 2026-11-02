import { afterAll, beforeAll, describe, expect, it } from "vitest";

import request from "supertest";

import app from "./server.js";
import { pool } from "./config/database.js";
import { connectRedis, redisClient } from "./config/redis.js";

describe("POST /drivers", () => {
  it("creates a driver with valid input", async () => {
    let createdDriverId;

    try {
      const response = await request(app).post("/drivers").send({
        name: "Automated Test Driver",
        vehicleType: "BIKE",
      });

      createdDriverId = response.body.data?.id;

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe("Automated Test Driver");
      expect(response.body.data.vehicle_type).toBe("BIKE");
      expect(response.body.data.status).toBe("OFFLINE");
    } finally {
      if (createdDriverId) {
        await pool.query("DELETE FROM drivers WHERE id = $1", [
          createdDriverId,
        ]);
      }
    }
  });

  it("rejects an invalid vehicle type", async () => {
    const response = await request(app).post("/drivers").send({
      name: "Automated Test Driver",
      vehicleType: "PLANE",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  it("rejects a whitespace-only driver name", async () => {
    const response = await request(app).post("/drivers").send({
      name: "   ",
      vehicleType: "BIKE",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });
});

describe("GET /drivers/:id", () => {
  it("returns a driver when the ID exists", async () => {
    const createResponse = await request(app).post("/drivers").send({
      name: "GET Test Driver",
      vehicleType: "CAR",
    });

    const driverId = createResponse.body.data.id;

    try {
      const response = await request(app).get(`/drivers/${driverId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(driverId);
      expect(response.body.data.name).toBe("GET Test Driver");
    } finally {
      await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
    }
  });

  it("returns 404 when the driver does not exist", async () => {
    const response = await request(app).get(
      "/drivers/00000000-0000-0000-0000-000000000000",
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Driver not found");
  });

  it("returns 400 when the driver ID is invalid", async () => {
    const response = await request(app).get("/drivers/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid driver ID");
  });
});

describe("PATCH /drivers/:id/status", () => {
  it("updates a driver's status", async () => {
    const createResponse = await request(app).post("/drivers").send({
      name: "Status Test Driver",
      vehicleType: "BIKE",
    });

    const driverId = createResponse.body.data.id;

    try {
      const response = await request(app)
        .patch(`/drivers/${driverId}/status`)
        .send({ status: "AVAILABLE" });

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(driverId);
      expect(response.body.data.status).toBe("AVAILABLE");
    } finally {
      await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
    }
  });

  it("rejects an invalid driver status", async () => {
    const response = await request(app)
      .patch("/drivers/00000000-0000-0000-0000-000000000000/status")
      .send({ status: "BUSY" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid driver status");
  });

  it("rejects an invalid driver ID", async () => {
    const response = await request(app)
      .patch("/drivers/not-a-uuid/status")
      .send({ status: "AVAILABLE" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid driver ID");
  });

  it("returns 404 when the driver does not exist", async () => {
    const response = await request(app)
      .patch("/drivers/00000000-0000-0000-0000-000000000000/status")
      .send({ status: "AVAILABLE" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Driver not found");
  });

  it("rejects OFFLINE to ON_TRIP", async () => {
    const createResponse = await request(app).post("/drivers").send({
      name: "Transition Test Driver",
      vehicleType: "BIKE",
    });

    const driverId = createResponse.body.data.id;

    try {
      const response = await request(app)
        .patch(`/drivers/${driverId}/status`)
        .send({ status: "ON_TRIP" });

      expect(response.status).toBe(409);
    } finally {
      await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
    }
  });

  it("allows OFFLINE to AVAILABLE", async () => {
    const createResponse = await request(app).post("/drivers").send({
      name: "Available Transition Driver",
      vehicleType: "CAR",
    });

    const driverId = createResponse.body.data.id;

    try {
      const response = await request(app)
        .patch(`/drivers/${driverId}/status`)
        .send({ status: "AVAILABLE" });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("AVAILABLE");
    } finally {
      await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
    }
  });
});

describe("PATCH /drivers/:id/location", () => {
  it("updates a driver's location", async () => {
    const createResponse = await request(app).post("/drivers").send({
      name: "Location Test Driver",
      vehicleType: "BIKE",
    });

    const driverId = createResponse.body.data.id;

    try {
      const response = await request(app)
        .patch(`/drivers/${driverId}/location`)
        .send({
          latitude: 19.076,
          longitude: 72.8777,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.driverId).toBe(driverId);
      expect(response.body.data.latitude).toBe(19.076);
      expect(response.body.data.longitude).toBe(72.8777);

      const coordinates = await redisClient.geoPos("drivers:geo", driverId);

      expect(coordinates).not.toBeNull();
    } finally {
      await redisClient.zRem("drivers:geo", driverId);
      await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
    }
  });

  it("rejects an invalid driver ID", async () => {
    const response = await request(app)
      .patch("/drivers/not-a-uuid/location")
      .send({
        latitude: 19.076,
        longitude: 72.8777,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid driver ID");
  });

  it("rejects an out-of-range latitude", async () => {
    const response = await request(app)
      .patch("/drivers/00000000-0000-0000-0000-000000000000/location")
      .send({
        latitude: 95,
        longitude: 72.8777,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid location coordinates");
  });

  it("rejects an out-of-range longitude", async () => {
    const response = await request(app)
      .patch("/drivers/00000000-0000-0000-0000-000000000000/location")
      .send({
        latitude: 19.076,
        longitude: 200,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid location coordinates");
  });

  it("returns 404 when the driver does not exist", async () => {
    const response = await request(app)
      .patch("/drivers/00000000-0000-0000-0000-000000000000/location")
      .send({
        latitude: 19.076,
        longitude: 72.8777,
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Driver not found");
  });
});

describe("GET /drivers/nearby", () => {
  it("returns nearby available drivers", async () => {
    let driverId;

    try {
      // 1. Create a driver
      const createResponse = await request(app).post("/drivers").send({
        name: "Nearby Test Driver",
        vehicleType: "BIKE",
      });

      expect(createResponse.status).toBe(201);

      driverId = createResponse.body.data.id;

      // 2. Make the driver available
      const statusResponse = await request(app)
        .patch(`/drivers/${driverId}/status`)
        .send({
          status: "AVAILABLE",
        });

      expect(statusResponse.status).toBe(200);

      // 3. Save the driver's location
      const locationResponse = await request(app)
        .patch(`/drivers/${driverId}/location`)
        .send({
          latitude: 19.076,
          longitude: 72.8777,
        });

      expect(locationResponse.status).toBe(200);

      // 4. Search for nearby drivers
      const nearbyResponse = await request(app).get("/drivers/nearby").query({
        latitude: 19.076,
        longitude: 72.8777,
        radius: 3000,
      });

      expect(nearbyResponse.status).toBe(200);
      expect(nearbyResponse.body.count).toBeGreaterThan(0);

      // Our driver must appear in the results
      const returnedIds = nearbyResponse.body.data.map((driver) => driver.id);

      expect(returnedIds).toContain(driverId);
    } finally {
      // Remove test data from Redis and PostgreSQL
      if (driverId) {
        await redisClient.zRem("drivers:geo", driverId);

        await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
      }
    }
  });
  it("excludes OFFLINE drivers from nearby results", async () => {
    let driverId;

    try {
      const createResponse = await request(app).post("/drivers").send({
        name: "Offline Test Driver",
        vehicleType: "BIKE",
      });

      expect(createResponse.status).toBe(201);
      driverId = createResponse.body.data.id;

      // Save a location while the driver is OFFLINE.
      const locationResponse = await request(app)
        .patch(`/drivers/${driverId}/location`)
        .send({
          latitude: 19.076,
          longitude: 72.8777,
        });

      expect(locationResponse.status).toBe(200);

      const nearbyResponse = await request(app).get("/drivers/nearby").query({
        latitude: 19.076,
        longitude: 72.8777,
        radius: 3000,
      });

      expect(nearbyResponse.status).toBe(200);

      const returnedIds = nearbyResponse.body.data.map((driver) => driver.id);

      expect(returnedIds).not.toContain(driverId);
    } finally {
      if (driverId) {
        await redisClient.zRem("drivers:geo", driverId);
        await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
      }
    }
  });

  it("excludes ON_TRIP drivers from nearby results", async () => {
    let driverId;

    try {
      const createResponse = await request(app).post("/drivers").send({
        name: "On Trip Test Driver",
        vehicleType: "CAR",
      });

      expect(createResponse.status).toBe(201);
      driverId = createResponse.body.data.id;

      // OFFLINE -> AVAILABLE
      const availableResponse = await request(app)
        .patch(`/drivers/${driverId}/status`)
        .send({ status: "AVAILABLE" });

      expect(availableResponse.status).toBe(200);

      // AVAILABLE -> ON_TRIP
      const onTripResponse = await request(app)
        .patch(`/drivers/${driverId}/status`)
        .send({ status: "ON_TRIP" });

      expect(onTripResponse.status).toBe(200);

      const locationResponse = await request(app)
        .patch(`/drivers/${driverId}/location`)
        .send({
          latitude: 19.076,
          longitude: 72.8777,
        });

      expect(locationResponse.status).toBe(200);

      const nearbyResponse = await request(app).get("/drivers/nearby").query({
        latitude: 19.076,
        longitude: 72.8777,
        radius: 3000,
      });

      expect(nearbyResponse.status).toBe(200);

      const returnedIds = nearbyResponse.body.data.map((driver) => driver.id);

      expect(returnedIds).not.toContain(driverId);
    } finally {
      if (driverId) {
        await redisClient.zRem("drivers:geo", driverId);
        await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
      }
    }
  });
  it("rejects latitude outside the valid range", async () => {
    const response = await request(app).get("/drivers/nearby").query({
      latitude: 95,
      longitude: 72.8777,
    });

    expect(response.status).toBe(400);
  });

  it("rejects longitude outside the valid range", async () => {
    const response = await request(app).get("/drivers/nearby").query({
      latitude: 19.076,
      longitude: 200,
    });

    expect(response.status).toBe(400);
  });
  it("uses the default radius when radius is omitted", async () => {
    let driverId;

    try {
      const createResponse = await request(app).post("/drivers").send({
        name: "Default Radius Test Driver",
        vehicleType: "BIKE",
      });

      expect(createResponse.status).toBe(201);
      driverId = createResponse.body.data.id;

      const statusResponse = await request(app)
        .patch(`/drivers/${driverId}/status`)
        .send({ status: "AVAILABLE" });

      expect(statusResponse.status).toBe(200);

      const locationResponse = await request(app)
        .patch(`/drivers/${driverId}/location`)
        .send({
          latitude: 19.076,
          longitude: 72.8777,
        });

      expect(locationResponse.status).toBe(200);

      // Notice: radius is intentionally omitted.
      const nearbyResponse = await request(app).get("/drivers/nearby").query({
        latitude: 19.076,
        longitude: 72.8777,
      });

      expect(nearbyResponse.status).toBe(200);

      const returnedIds = nearbyResponse.body.data.map((driver) => driver.id);

      expect(returnedIds).toContain(driverId);
    } finally {
      if (driverId) {
        await redisClient.zRem("drivers:geo", driverId);

        await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
      }
    }
  });
});

describe("GET /drivers/:id/location", () => {
  it("returns driver location when location is saved", async () => {
    let driverId;
    try {
      const createResponse = await request(app).post("/drivers").send({
        name: "Location Test Driver",
        vehicleType: "CAR",
      });
      driverId = createResponse.body.data.id;

      await request(app)
        .patch(`/drivers/${driverId}/location`)
        .send({ latitude: 19.076, longitude: 72.8777 });

      const response = await request(app).get(`/drivers/${driverId}/location`);

      expect(response.status).toBe(200);
      expect(response.body.data.driverId).toBe(driverId);
      expect(response.body.data.latitude).toBeCloseTo(19.076, 3);
      expect(response.body.data.longitude).toBeCloseTo(72.8777, 3);
    } finally {
      if (driverId) {
        await redisClient.zRem("drivers:geo", driverId);
        await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
      }
    }
  });

  it("returns 404 when location is not set", async () => {
    let driverId;
    try {
      const createResponse = await request(app).post("/drivers").send({
        name: "No Location Driver",
        vehicleType: "BIKE",
      });
      driverId = createResponse.body.data.id;

      const response = await request(app).get(`/drivers/${driverId}/location`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Driver location not found");
    } finally {
      if (driverId) {
        await pool.query("DELETE FROM drivers WHERE id = $1", [driverId]);
      }
    }
  });
});

beforeAll(async () => {
  await connectRedis();
});

afterAll(async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }

  await pool.end();
});
