import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "./server.js";
import { pool } from "./config/database.js";

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

afterAll(async () => {
  await pool.end();
});
