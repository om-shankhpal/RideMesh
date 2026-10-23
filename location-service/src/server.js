import "dotenv/config";
import express from "express";
import driverRoutes from "./routes/driver.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { connectRedis } from "./config/redis.js";

const app = express();

app.use(express.json());

app.use("/drivers", driverRoutes);

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "UP",
        service: "location-service",
    });
});

app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== "test") {
    const PORT = process.env.PORT || 3001;

    async function startServer() {
        try {
            await connectRedis();

            app.listen(PORT, () => {
                console.log(
                    `Location service listening on port ${PORT}`
                );
            });
        } catch (error) {
            console.error("Failed to start location service:", error.message);
            process.exitCode = 1;
        }
    }

    startServer();
}