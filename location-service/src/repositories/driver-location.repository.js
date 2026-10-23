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

export async function findNearbyDriverIds({
    latitude,
    longitude,
    radius,
}) {
    const driverIds = await redisClient.geoSearch(
        DRIVER_GEO_KEY,
        {
            longitude,
            latitude,
        },
        {
            radius,
            unit: "m",
        },
        {
            SORT: "ASC",
        },
    );

    return driverIds;
}

