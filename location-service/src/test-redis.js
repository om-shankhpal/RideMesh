import "dotenv/config";
import { connectRedis, redisClient } from "./config/redis.js";

try {
    await connectRedis();

    const response = await redisClient.ping();

    console.log("Redis ping response:", response);
} catch (error) {
    console.error("Redis connection test failed:", error.message);
    process.exitCode = 1;
} finally {
    if (redisClient.isOpen) {
        await redisClient.quit();
    }
}