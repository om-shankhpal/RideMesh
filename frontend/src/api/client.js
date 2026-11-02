const API_BASES = {
  location: "/api/location",
  rides: "/api/rides",
  matches: "/api/matches",
};

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.error || result?.message || `Request failed (${response.status})`,
    );
  }

  return result;
}

export const api = {
  // Location Service
  getServiceHealth: (service) => {
    const base = API_BASES[service];

    if (!base) {
      throw new Error(`Unknown service: ${service}`);
    }

    return request(base, "/health");
  },

  getDrivers: () => request(API_BASES.location, "/drivers"),

  createDriver: (driver) =>
    request(API_BASES.location, "/drivers", {
      method: "POST",
      body: JSON.stringify(driver),
    }),

  getNearbyDrivers: ({ latitude, longitude, radius = 5000 }) =>
    request(
      API_BASES.location,
      `/drivers/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`,
    ),

  getDriver: (id) =>
    request(API_BASES.location, `/drivers/${encodeURIComponent(id)}`),

  getDriverLocation: (id) =>
    request(API_BASES.location, `/drivers/${encodeURIComponent(id)}/location`),

  updateDriver: (id, driver) =>
    request(
      API_BASES.location,
      `/drivers/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(driver),
      }
    ),
  
  updateDriverLocation: (id, location) =>
    request(API_BASES.location, `/drivers/${encodeURIComponent(id)}/location`, {
      method: "PATCH",
      body: JSON.stringify(location),
    }),

  updateDriverStatus: (id, status) =>
    request(API_BASES.location, `/drivers/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Ride Service
  getRides: () => request(API_BASES.rides, ""),

  createRide: (ride) =>
    request(API_BASES.rides, "", {
      method: "POST",
      body: JSON.stringify(ride),
    }),

  getRide: (id) => request(API_BASES.rides, `/${encodeURIComponent(id)}`),

  updateRideStatus: (id, status) =>
    request(API_BASES.rides, `/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  assignDriver: (rideId, driverId) =>
    request(API_BASES.rides, `/${encodeURIComponent(rideId)}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ driverId }),
    }),

  // Match Service
  matchRide: (rideId) =>
    request(API_BASES.matches, `/${encodeURIComponent(rideId)}`, {
      method: "POST",
    }),
};
