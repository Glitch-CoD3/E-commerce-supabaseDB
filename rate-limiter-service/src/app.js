import express from "express";
import rateLimitRoutes from "./routes/rateLimit.routes.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "rate-limiter-service",
        status: "healthy",
    });
});

app.use("/api/v1/rate-limit", rateLimitRoutes);

export default app;