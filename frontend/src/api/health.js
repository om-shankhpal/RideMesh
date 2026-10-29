
const services = [
  { key: "location", name: "Location Service" },
  { key: "rides", name: "Ride Service" },
  { key: "matches", name: "Match Service" },
];

export async function fetchServiceHealth() {
  const results = await Promise.all(
    services.map(async (service) => {
      try {
        const response = await fetch(`/api/${service.key}/health`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        return {
          ...service,
          status: data.status === "UP" ? "UP" : "DOWN",
        };
      } catch {
        return {
          ...service,
          status: "DOWN",
        };
      }
    })
  );

  return results;
}
