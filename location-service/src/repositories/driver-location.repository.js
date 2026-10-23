import { redisClient } from "../config/redis.js";

const DRIVER_GEO_KEY = "drivers:geo";

export async function saveDriverLocation(
    driverId,
    { latitude, longitude }
) {
    await redisClient.geoAdd(DRIVER_GEO_KEY, {
        longitude,
        latitude,
        member: driverId,
    });
}