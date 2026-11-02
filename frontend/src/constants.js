export const SIMULATED_RIDERS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Aarav Sharma",
    phone: "+91 98201 11223",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Priya Patel",
    phone: "+91 98202 22334",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Rohan Mehta",
    phone: "+91 98203 33445",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Ananya Iyer",
    phone: "+91 98204 44556",
  },
];

export const MUMBAI_ROUTE_PRESETS = [
  {
    name: "Bandra West → BKC",
    desc: "Linking Rd to Diamond Bourse",
    pickupLat: 19.06,
    pickupLng: 72.834,
    dropoffLat: 19.0688,
    dropoffLng: 72.8687,
  },
  {
    name: "Colaba → Marine Drive",
    desc: "Gateway of India to Marine Drive",
    pickupLat: 18.922,
    pickupLng: 72.8347,
    dropoffLat: 18.943,
    dropoffLng: 72.823,
  },
  {
    name: "Airport (BOM) → Andheri",
    desc: "Terminal 2 to MIDC Tech Park",
    pickupLat: 19.0896,
    pickupLng: 72.8656,
    dropoffLat: 19.1136,
    dropoffLng: 72.8697,
  },
  {
    name: "Dadar TT → Lower Parel",
    desc: "Dadar Circle to Palladium",
    pickupLat: 19.018,
    pickupLng: 72.843,
    dropoffLat: 18.995,
    dropoffLng: 72.83,
  },
];

export const MUMBAI_LOCATION_PRESETS = [
  { name: "Bandra West", lat: 19.06, lng: 72.834 },
  { name: "BKC G-Block", lat: 19.0688, lng: 72.8687 },
  { name: "Mumbai Airport T2", lat: 19.0896, lng: 72.8656 },
  { name: "Colaba / Gateway", lat: 18.922, lng: 72.8347 },
  { name: "Lower Parel / Worli", lat: 18.995, lng: 72.83 },
  { name: "Andheri Station", lat: 19.1197, lng: 72.8464 },
];

export function getRiderDisplayName(riderId) {
  if (!riderId) return "Unknown rider";
  const found = SIMULATED_RIDERS.find((r) => r.id === riderId);
  if (found) return `${found.name} (Simulated)`;
  return `Rider · ${riderId.slice(0, 8)}`;
}

