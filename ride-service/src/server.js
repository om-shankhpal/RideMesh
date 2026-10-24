import "dotenv/config";

import express from "express";

import rideRoutes from "./routes/ride.routes.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    return res.status(200).json({
        status: "UP",
        service: "ride-service",
    });
});

app.use("/rides", rideRoutes);

export default app;

if (process.env.NODE_ENV !== "test") {
    const PORT = process.env.PORT || 3002;

    app.listen(PORT, () => {
        console.log(`Ride service listening on port ${PORT}`);
    });
}