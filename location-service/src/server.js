import "dotenv/config";
import express from "express";
import driverRoutes from "./routes/driver.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

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

    app.listen(PORT, () => {
        console.log(`Location service listening on port ${PORT}`);
    });
}