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

describe("GET /drivers/:id", () => {
    it("returns a driver when the ID exists", async () => {
        const createResponse = await request(app)
            .post("/drivers")
            .send({
                name: "GET Test Driver",
                vehicleType: "CAR",
            });

        const driverId = createResponse.body.data.id;

        try {
            const response = await request(app)
                .get(`/drivers/${driverId}`);

            expect(response.status).toBe(200);
            expect(response.body.data.id).toBe(driverId);
            expect(response.body.data.name).toBe("GET Test Driver");
        } finally {
            await pool.query(
                "DELETE FROM drivers WHERE id = $1",
                [driverId]
            );
        }
    });

    it("returns 404 when the driver does not exist", async () => {
        const response = await request(app)
            .get("/drivers/00000000-0000-0000-0000-000000000000");

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Driver not found");
    });

    it("returns 400 when the driver ID is invalid", async () => {
        const response = await request(app)
            .get("/drivers/not-a-uuid");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid driver ID");
    });
});

afterAll(async () => {
  await pool.end();
});
