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

export async function getDriverLocation(driverId) {
    try {
        const positions = await redisClient.geoPos(DRIVER_GEO_KEY, [driverId]);
        const pos = positions?.[0];
        if (pos && pos.latitude != null && pos.longitude != null) {
            return {
                latitude: Number(pos.latitude),
                longitude: Number(pos.longitude),
            };
        }
        return null;
    } catch (error) {
        console.error("Failed to retrieve driver location from Redis:", error.message);
        return null;
    }
}

export async function getDriversLocations(driverIds) {
    if (!driverIds || driverIds.length === 0) {
        return {};
    }
    try {
        const positions = await redisClient.geoPos(DRIVER_GEO_KEY, driverIds);
        const result = {};
        driverIds.forEach((id, index) => {
            const pos = positions?.[index];
            if (pos && pos.latitude != null && pos.longitude != null) {
                result[id] = {
                    latitude: Number(pos.latitude),
                    longitude: Number(pos.longitude),
                };
            }
        });
        return result;
    } catch (error) {
        console.error("Failed to retrieve driver locations from Redis:", error.message);
        return {};
    }
}
