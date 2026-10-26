import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "./server.js";

describe("Match Service health check", () => {
    it("returns UP when the service is healthy", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: "UP",
            service: "match-service",
        });
    });
});