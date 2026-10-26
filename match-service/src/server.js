import "dotenv/config";
import express from "express";

import matchRoutes from "./routes/match.routes.js";

const app = express();

app.use(express.json());

app.use("/matches", matchRoutes);

app.get("/health", (req, res) => {
    return res.status(200).json({
        status: "UP",
        service: "match-service",
    });
});

export default app;

if (process.env.NODE_ENV !== "test") {
    const PORT = process.env.PORT || 3003;

    app.listen(PORT, () => {
        console.log(`Match service listening on port ${PORT}`);
    });
}