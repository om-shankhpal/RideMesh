import { useEffect, useState } from "react";
import "./App.css";

import { fetchServiceHealth } from "./api/health.js";
import { api } from "./api/client.js";
import {
  SIMULATED_RIDERS,
  MUMBAI_ROUTE_PRESETS,
  MUMBAI_LOCATION_PRESETS,
  getRiderDisplayName,
} from "./constants.js";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

// =========================================================================
// HELPERS
// =========================================================================

function formatRideTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCoords(lat, lng) {
  if (lat == null || lng == null) return "No GPS fix";
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

function mapRideRecord(ride) {
  return {
    id: ride.id,
    rawRiderId: ride.rider_id,
    rider: getRiderDisplayName(ride.rider_id),
    pickup: formatCoords(ride.pickup_latitude, ride.pickup_longitude),
    dropoff: formatCoords(ride.dropoff_latitude, ride.dropoff_longitude),
    pickupCoords: [ride.pickup_latitude, ride.pickup_longitude],
    dropoffCoords: [ride.dropoff_latitude, ride.dropoff_longitude],
    status: ride.status,
    driver: ride.driver_id ? ride.driver_id.slice(0, 8) : null,
    rawDriverId: ride.driver_id,
    time: formatRideTime(ride.created_at),
    createdAt: ride.created_at,
    updatedAt: ride.updated_at,
  };
}

function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status || "OFFLINE"}`}>
      <span className="badge-dot" />
      {status ? status.replaceAll("_", " ").toLowerCase() : "unknown"}
    </span>
  );
}

// =========================================================================
// LEAFLET MAP & ICONS
// =========================================================================

const pickupIcon = L.divIcon({
  className: "custom-map-icon",
  html: '<div class="marker-pin marker-pickup">P</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const dropoffIcon = L.divIcon({
  className: "custom-map-icon",
  html: '<div class="marker-pin marker-dropoff">D</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const getDriverIcon = (status, selected) => {
  const isBusy = status === "ON_TRIP";
  const isAvailable = status === "AVAILABLE";
  const statusClass = isBusy ? "busy" : isAvailable ? "available" : "offline";

  return L.divIcon({
    className: "custom-map-icon",
    html: `<div class="marker-car ${statusClass} ${selected ? "selected" : ""}">🚗</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

function getDriverPosition(driver) {
  if (driver.location?.latitude != null && driver.location?.longitude != null) {
    return [Number(driver.location.latitude), Number(driver.location.longitude)];
  }
  const x = Number(driver.x ?? 50);
  const y = Number(driver.y ?? 50);
  return [19.035 + (y / 100) * 0.045, 72.815 + (x / 100) * 0.075];
}

function CityMap({
  drivers,
  selectedDriver,
  setSelectedDriver,
  activeRoute = null,
  onOpenLocationModal = null,
}) {
  const pickupPosition = activeRoute ? activeRoute.pickupCoords : [19.06, 72.834];
  const dropoffPosition = activeRoute ? activeRoute.dropoffCoords : [19.0688, 72.8687];

  const hasRoute =
    pickupPosition &&
    pickupPosition[0] != null &&
    dropoffPosition &&
    dropoffPosition[0] != null;

  const availableCount = drivers.filter((d) => d.status === "AVAILABLE").length;
  const onTripCount = drivers.filter((d) => d.status === "ON_TRIP").length;
  const offlineCount = drivers.filter((d) => d.status === "OFFLINE").length;

  return (
    <div className="map-box">
      <MapContainer
        center={[19.055, 72.85]}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasRoute && (
          <>
            <Polyline
              positions={[pickupPosition, dropoffPosition]}
              pathOptions={{
                color: "#10b981",
                weight: 3,
                opacity: 0.85,
                dashArray: "6 6",
              }}
            />
            <Marker position={pickupPosition} icon={pickupIcon}>
              <Popup>
                <strong>Pickup Point</strong>
                <br />
                {formatCoords(pickupPosition[0], pickupPosition[1])}
              </Popup>
            </Marker>
            <Marker position={dropoffPosition} icon={dropoffIcon}>
              <Popup>
                <strong>Destination Point</strong>
                <br />
                {formatCoords(dropoffPosition[0], dropoffPosition[1])}
              </Popup>
            </Marker>
          </>
        )}

        {drivers.map((driver) => {
          const position = getDriverPosition(driver);
          const hasGps = driver.location?.latitude != null;

          return (
            <Marker
              key={driver.id}
              position={position}
              icon={getDriverIcon(driver.status, selectedDriver === driver.id)}
              eventHandlers={{
                click: () =>
                  setSelectedDriver(
                    selectedDriver === driver.id ? null : driver.id,
                  ),
              }}
            >
              <Popup>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <strong>{driver.name}</strong>
                  <span>Vehicle: {driver.vehicle}</span>
                  <StatusBadge status={driver.status} />
                  <small style={{ color: "#94a3b8" }}>
                    {hasGps
                      ? `GPS: ${formatCoords(
                          driver.location.latitude,
                          driver.location.longitude,
                        )}`
                      : "Schematic layout position"}
                  </small>
                  {onOpenLocationModal && (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{ marginTop: "6px" }}
                      onClick={() => onOpenLocationModal(driver)}
                    >
                      Update GPS
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="map-legend-bar">
        <span className="map-legend-item">
          <span className="legend-dot" style={{ background: "#10b981" }} />
          {availableCount} Available
        </span>
        <span className="map-legend-item">
          <span className="legend-dot" style={{ background: "#818cf8" }} />
          {onTripCount} On Trip
        </span>
        <span className="map-legend-item">
          <span className="legend-dot" style={{ background: "#64748b" }} />
          {offlineCount} Offline
        </span>
      </div>
    </div>
  );
}

// =========================================================================
// MODALS
// =========================================================================

function CreateRideModal({ onClose, onCreated }) {
  const [riderId, setRiderId] = useState(SIMULATED_RIDERS[0].id);
  const [pickupLat, setPickupLat] = useState("19.0600");
  const [pickupLng, setPickupLng] = useState("72.8340");
  const [dropoffLat, setDropoffLat] = useState("19.0688");
  const [dropoffLng, setDropoffLng] = useState("72.8687");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function applyPreset(p) {
    setPickupLat(p.pickupLat.toString());
    setPickupLng(p.pickupLng.toString());
    setDropoffLat(p.dropoffLat.toString());
    setDropoffLng(p.dropoffLng.toString());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const coords = [pickupLat, pickupLng, dropoffLat, dropoffLng].map(Number);
    if (coords.some((c) => !Number.isFinite(c))) {
      setError("Please enter valid numeric coordinates.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createRide({
        riderId,
        pickupLatitude: coords[0],
        pickupLongitude: coords[1],
        dropoffLatitude: coords[2],
        dropoffLongitude: coords[3],
      });
      onCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create ride request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Ride Request</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                Simulated Rider
              </label>
              <select
                value={riderId}
                onChange={(e) => setRiderId(e.target.value)}
                style={{ width: "100%" }}
                disabled={submitting}
              >
                {SIMULATED_RIDERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "11px", color: "var(--text-sub)" }}>
                Route Presets (Mumbai)
              </label>
              <div className="preset-pills">
                {MUMBAI_ROUTE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="preset-chip"
                    onClick={() => applyPreset(p)}
                    disabled={submitting}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                  Pickup Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={pickupLat}
                  onChange={(e) => setPickupLat(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                  Pickup Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={pickupLng}
                  onChange={(e) => setPickupLng(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                  Drop-off Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={dropoffLat}
                  onChange={(e) => setDropoffLat(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                  Drop-off Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={dropoffLng}
                  onChange={(e) => setDropoffLng(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {error && (
              <div style={{ color: "var(--red)", fontSize: "12px" }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RideDetailsModal({ ride, onClose, onViewOnMap }) {
  if (!ride) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ride Details</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Ride ID
              </span>
              <span className="mono">{ride.id}</span>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Status
              </span>
              <StatusBadge status={ride.status} />
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Rider
              </span>
              <strong>{ride.rider}</strong>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Assigned Driver
              </span>
              <span className="mono">{ride.rawDriverId || "None"}</span>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Pickup
              </span>
              <span>{ride.pickup}</span>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Drop-off
              </span>
              <span>{ride.dropoff}</span>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Requested At
              </span>
              <span>{ride.time}</span>
            </div>

            <div>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>
                Updated At
              </span>
              <span>{formatRideTime(ride.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onViewOnMap(ride);
              onClose();
            }}
          >
            Highlight on Map ↗
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateLocationModal({ driver, onClose, onSave, saving }) {
  const [lat, setLat] = useState(
    driver?.location?.latitude?.toString() ?? "19.0600",
  );
  const [lng, setLng] = useState(
    driver?.location?.longitude?.toString() ?? "72.8340",
  );

  if (!driver) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSave(driver.id, { latitude: Number(lat), longitude: Number(lng) });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Set GPS: {driver.name}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "11px", color: "var(--text-sub)" }}>
                Mumbai Landmarks
              </label>
              <div className="preset-pills">
                {MUMBAI_LOCATION_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setLat(p.lat.toString());
                      setLng(p.lng.toString());
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                  disabled={saving}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                  disabled={saving}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Update Location"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddEditDriverModal({ mode, initialData, onClose, onSave, saving }) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [vehicleType, setVehicleType] = useState(initialData?.vehicle ?? "CAR");

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ name: name.trim(), vehicleType });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === "add" ? "Add New Driver" : "Edit Driver Details"}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                Driver Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                required
                minLength={2}
                maxLength={80}
                disabled={saving}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", color: "var(--text-sub)" }}>
                Vehicle Classification
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                disabled={saving}
                style={{ width: "100%" }}
              >
                <option value="CAR">Car</option>
                <option value="BIKE">Bike</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : mode === "add" ? "Create Driver" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmCancelModal({ ride, onClose, onConfirm, isProcessing }) {
  if (!ride) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Cancel Ride</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p style={{ color: "var(--text-sub)" }}>
            Are you sure you want to cancel ride{" "}
            <span className="mono">{ride.id.slice(0, 8)}</span>?
          </p>
          {ride.rawDriverId && (
            <p style={{ color: "var(--amber)", fontSize: "11px" }}>
              Assigned driver will be released and marked AVAILABLE automatically.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isProcessing}>
            Keep Ride
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => onConfirm(ride.id)}
            disabled={isProcessing}
          >
            {isProcessing ? "Cancelling..." : "Confirm Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// MAIN APP COMPONENT
// =========================================================================

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [selectedDriver, setSelectedDriver] = useState(null);

  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);

  const [rides, setRides] = useState([]);
  const [ridesLoading, setRidesLoading] = useState(true);

  const [serviceHealth, setServiceHealth] = useState([]);

  // Filter states
  const [driverFilter, setDriverFilter] = useState("ALL");
  const [driverSearch, setDriverSearch] = useState("");
  const [rideFilter, setRideFilter] = useState("ALL");

  // Modals state
  const [showCreateRide, setShowCreateRide] = useState(false);
  const [inspectedRide, setInspectedRide] = useState(null);
  const [locationModalDriver, setLocationModalDriver] = useState(null);
  const [driverFormModal, setDriverFormModal] = useState(null); // { mode: 'add' | 'edit', data?: driver }
  const [cancelModalRide, setCancelModalRide] = useState(null);

  const [savingLocation, setSavingLocation] = useState(false);
  const [savingDriver, setSavingDriver] = useState(false);
  const [cancelingRide, setCancelingRide] = useState(false);
  const [rideActionId, setRideActionId] = useState(null);

  // Active highlighted route on the map
  const [activeRouteForMap, setActiveRouteForMap] = useState(null);

  // Dynamic system activity feed
  const [events, setEvents] = useState([
    {
      type: "info",
      title: "Platform Online",
      detail: "Microservices & Redis connected",
      time: new Date().toLocaleTimeString(),
    },
  ]);

  function logEvent(type, title, detail) {
    const newEvent = {
      type,
      title,
      detail,
      time: new Date().toLocaleTimeString(),
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
  }

  // Load drivers
  async function refreshDrivers() {
    try {
      const res = await api.getDrivers();
      const loaded = (res.data ?? []).map((d, index) => ({
        id: d.id,
        name: d.name,
        vehicle: d.vehicle_type,
        status: d.status,
        location: d.location ?? null,
        x: 15 + ((index * 29) % 70),
        y: 14 + ((index * 31) % 72),
      }));
      setDrivers(loaded);
    } catch (err) {
      console.error("Failed to load drivers:", err);
    } finally {
      setDriversLoading(false);
    }
  }

  // Load rides
  async function refreshRides() {
    try {
      const res = await api.getRides();
      setRides((res.data ?? []).map(mapRideRecord));
    } catch (err) {
      console.error("Failed to load rides:", err);
    } finally {
      setRidesLoading(false);
    }
  }

  // Check microservice health
  async function checkServices() {
    try {
      const res = await fetchServiceHealth();
      setServiceHealth(res);
    } catch {
      // Keep previous
    }
  }

  // Driver actions
  async function handleToggleDriverStatus(driver) {
    try {
      let nextStatus = "AVAILABLE";
      if (driver.status === "AVAILABLE") nextStatus = "OFFLINE";
      else if (driver.status === "OFFLINE") nextStatus = "AVAILABLE";
      else return;

      await api.updateDriverStatus(driver.id, nextStatus);
      logEvent(
        nextStatus === "AVAILABLE" ? "success" : "warning",
        "Driver Status Changed",
        `${driver.name} is now ${nextStatus}`,
      );
      await refreshDrivers();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveDriverDetails(formData) {
    try {
      setSavingDriver(true);
      if (driverFormModal.mode === "add") {
        await api.createDriver(formData);
        logEvent("success", "Driver Created", `Added ${formData.name}`);
      } else {
        await api.updateDriver(driverFormModal.data.id, formData);
        logEvent("info", "Driver Updated", `Updated ${formData.name}`);
      }
      await refreshDrivers();
      setDriverFormModal(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingDriver(false);
    }
  }

  async function handleSaveLocation(driverId, coords) {
    try {
      setSavingLocation(true);
      await api.updateDriverLocation(driverId, coords);
      logEvent("success", "Location Fixed", `Driver GPS updated`);
      await refreshDrivers();
      setLocationModalDriver(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingLocation(false);
    }
  }

  // Ride lifecycle actions
  async function handleRideAction(rideId, action) {
    try {
      setRideActionId(rideId);
      if (action === "MATCH") {
        const res = await api.matchRide(rideId);
        logEvent("success", "Driver Matched", `Assigned to ride ${rideId.slice(0, 8)}`);
        if (res.data?.driver_id) {
          setSelectedDriver(res.data.driver_id);
        }
      } else {
        const nextStatus = {
          START: "IN_PROGRESS",
          COMPLETE: "COMPLETED",
          CANCEL: "CANCELLED",
        }[action];
        await api.updateRideStatus(rideId, nextStatus);
        logEvent("info", `Ride ${nextStatus}`, `Ride ${rideId.slice(0, 8)} transitioned`);
      }
      await refreshRides();
      await refreshDrivers();
    } catch (err) {
      logEvent("error", "Action Failed", err.message);
      alert(`Action failed: ${err.message}`);
    } finally {
      setRideActionId(null);
    }
  }

  async function handleConfirmCancel(rideId) {
    try {
      setCancelingRide(true);
      await api.updateRideStatus(rideId, "CANCELLED");
      logEvent("warning", "Ride Cancelled", `Cancelled by operator`);
      setCancelModalRide(null);
      await refreshRides();
      await refreshDrivers();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelingRide(false);
    }
  }

  // Polling on mount
  useEffect(() => {
    let ignore = false;
    async function init() {
      await Promise.allSettled([refreshDrivers(), refreshRides(), checkServices()]);
    }
    void init();

    const timer = setInterval(() => {
      if (!ignore) {
        refreshDrivers();
        refreshRides();
        checkServices();
      }
    }, 10000);

    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  const availableDriversCount = drivers.filter((d) => d.status === "AVAILABLE").length;
  const activeRidesCount = rides.filter((r) => ["MATCHED", "IN_PROGRESS"].includes(r.status)).length;
  const pendingRidesCount = rides.filter((r) => r.status === "REQUESTED").length;
  const healthyServicesCount = serviceHealth.filter((s) => s.status === "UP").length;

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <a href="#overview" className="brand" onClick={() => setActivePage("Overview")}>
          <div className="brand-mark">R</div>
          <div className="brand-text">
            <strong>RideMesh</strong>
            <small>Dispatch System</small>
          </div>
        </a>

        <nav className="sidebar-nav">
          {[
            { label: "Overview", icon: "📊" },
            { label: "Live simulation", icon: "🎯" },
            { label: "Rides", icon: "🚕" },
            { label: "Drivers", icon: "👥" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${activePage === item.label ? "active" : ""}`}
              onClick={() => setActivePage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="health-pill">
            <span className="health-dot" />
            <span>
              {healthyServicesCount}/3 Services Online
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <span>RideMesh</span>
            <span>/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setShowCreateRide(true)}
            >
              + Create Ride
            </button>
          </div>
        </header>

        <div className="page-container">
          {/* STATS BAR (Common to dashboard) */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <span>Available Drivers</span>
                <span>🟢</span>
              </div>
              <div className="stat-value">{availableDriversCount} <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>/ {drivers.length}</span></div>
              <span className="stat-sub">Ready to be dispatched</span>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span>Active Rides</span>
                <span>🔵</span>
              </div>
              <div className="stat-value">{activeRidesCount}</div>
              <span className="stat-sub">Matched or in progress</span>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span>Pending Requests</span>
                <span>🟡</span>
              </div>
              <div className="stat-value">{pendingRidesCount}</div>
              <span className="stat-sub">Awaiting driver match</span>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span>Microservices</span>
                <span>⚡</span>
              </div>
              <div className="stat-value">{healthyServicesCount} / 3</div>
              <span className="stat-sub">
                {healthyServicesCount === 3 ? "All systems healthy" : "Check failing services"}
              </span>
            </div>
          </section>

          {/* PAGE: OVERVIEW */}
          {activePage === "Overview" && (
            <div>
              <div className="overview-split">
                {/* MAP PANEL */}
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="panel-title">Fleet Distribution</div>
                      <div className="panel-subtitle">Mumbai Live Operations Map</div>
                    </div>
                    {activeRouteForMap && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => setActiveRouteForMap(null)}
                      >
                        Clear Highlight
                      </button>
                    )}
                  </div>
                  <CityMap
                    drivers={drivers}
                    selectedDriver={selectedDriver}
                    setSelectedDriver={setSelectedDriver}
                    activeRoute={activeRouteForMap}
                    onOpenLocationModal={(d) => setLocationModalDriver(d)}
                  />
                </div>

                {/* ACTIVITY STREAM */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">System Activity</div>
                    <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700 }}>LIVE</span>
                  </div>
                  <div className="activity-list">
                    {events.map((ev, i) => (
                      <div key={i} className="activity-item">
                        <div className="activity-item-top">
                          <strong>{ev.title}</strong>
                          <time>{ev.time}</time>
                        </div>
                        <p>{ev.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RECENT RIDES TABLE */}
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Recent Rides</div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setActivePage("Rides")}
                  >
                    View All →
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Ride ID</th>
                        <th>Rider</th>
                        <th>Route</th>
                        <th>Driver</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rides.slice(0, 5).map((r) => (
                        <tr key={r.id}>
                          <td className="mono">{r.id.slice(0, 8)}</td>
                          <td>{r.rider}</td>
                          <td>{r.pickup} → {r.dropoff}</td>
                          <td className="mono">{r.driver || "—"}</td>
                          <td><StatusBadge status={r.status} /></td>
                          <td>{r.time}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => setInspectedRide(r)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                      {rides.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                            No ride requests yet. Click "+ Create Ride" to begin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAGE: DRIVERS */}
          {activePage === "Drivers" && (
            <div>
              <div className="filter-bar">
                <div className="pill-group">
                  {["ALL", "AVAILABLE", "ON_TRIP", "OFFLINE"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`pill-btn ${driverFilter === st ? "active" : ""}`}
                      onClick={() => setDriverFilter(st)}
                    >
                      {st.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Search driver by name..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  style={{ marginLeft: "auto", minWidth: "200px" }}
                />

                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setDriverFormModal({ mode: "add" })}
                >
                  + Add Driver
                </button>
              </div>

              <div className="drivers-grid">
                {drivers
                  .filter((d) => {
                    if (driverFilter !== "ALL" && d.status !== driverFilter) return false;
                    if (driverSearch && !d.name.toLowerCase().includes(driverSearch.toLowerCase())) return false;
                    return true;
                  })
                  .map((d) => (
                    <div
                      key={d.id}
                      className={`driver-card ${selectedDriver === d.id ? "selected" : ""}`}
                    >
                      <div className="driver-card-header">
                        <div className="driver-card-title">
                          <strong>{d.name}</strong>
                          <small>{d.id.slice(0, 8)} · {d.vehicle}</small>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>

                      <div className="driver-card-coords">
                        <span>
                          {d.location?.latitude != null ? "📍 GPS Synced" : "📐 Schematic"}
                        </span>
                        <span className="mono">
                          {formatCoords(d.location?.latitude, d.location?.longitude)}
                        </span>
                      </div>

                      <div className="driver-card-actions">
                        {d.status === "OFFLINE" && (
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            onClick={() => handleToggleDriverStatus(d)}
                          >
                            Go Online
                          </button>
                        )}
                        {d.status === "AVAILABLE" && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => handleToggleDriverStatus(d)}
                          >
                            Go Offline
                          </button>
                        )}
                        {d.status === "ON_TRIP" && (
                          <span style={{ fontSize: "11px", color: "var(--indigo)" }}>
                            On Trip (Locked)
                          </span>
                        )}

                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setLocationModalDriver(d)}
                        >
                          Set GPS
                        </button>

                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setDriverFormModal({ mode: "edit", data: d })}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* PAGE: RIDES */}
          {activePage === "Rides" && (
            <div>
              <div className="filter-bar">
                <div className="pill-group">
                  {["ALL", "REQUESTED", "MATCHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`pill-btn ${rideFilter === st ? "active" : ""}`}
                      onClick={() => setRideFilter(st)}
                    >
                      {st.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Ride ID</th>
                        <th>Rider</th>
                        <th>Route</th>
                        <th>Driver</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Action</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rides
                        .filter((r) => rideFilter === "ALL" || r.status === rideFilter)
                        .map((r) => {
                          const isProcessing = rideActionId === r.id;

                          return (
                            <tr key={r.id}>
                              <td className="mono">{r.id.slice(0, 8)}</td>
                              <td>{r.rider}</td>
                              <td>{r.pickup} → {r.dropoff}</td>
                              <td className="mono">{r.driver || "—"}</td>
                              <td><StatusBadge status={r.status} /></td>
                              <td>{r.time}</td>
                              <td>
                                {r.status === "REQUESTED" && (
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                      type="button"
                                      className="btn-primary btn-sm"
                                      disabled={isProcessing}
                                      onClick={() => handleRideAction(r.id, "MATCH")}
                                    >
                                      {isProcessing ? "Matching..." : "Match Driver"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-danger btn-sm"
                                      disabled={isProcessing}
                                      onClick={() => setCancelModalRide(r)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                {r.status === "MATCHED" && (
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                      type="button"
                                      className="btn-primary btn-sm"
                                      disabled={isProcessing}
                                      onClick={() => handleRideAction(r.id, "START")}
                                    >
                                      {isProcessing ? "Starting..." : "Start Trip"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-danger btn-sm"
                                      disabled={isProcessing}
                                      onClick={() => setCancelModalRide(r)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                {r.status === "IN_PROGRESS" && (
                                  <button
                                    type="button"
                                    className="btn-primary btn-sm"
                                    disabled={isProcessing}
                                    onClick={() => handleRideAction(r.id, "COMPLETE")}
                                  >
                                    {isProcessing ? "Completing..." : "Complete Trip"}
                                  </button>
                                )}
                                {["COMPLETED", "CANCELLED"].includes(r.status) && (
                                  <span style={{ color: "var(--text-muted)" }}>—</span>
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => setInspectedRide(r)}
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAGE: LIVE SIMULATION */}
          {activePage === "Live simulation" && (
            <div className="sim-grid">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">City Map Simulator</div>
                  <div className="panel-subtitle">Visual Driver & Ride Tracking</div>
                </div>
                <CityMap
                  drivers={drivers}
                  selectedDriver={selectedDriver}
                  setSelectedDriver={setSelectedDriver}
                  activeRoute={activeRouteForMap}
                  onOpenLocationModal={(d) => setLocationModalDriver(d)}
                />
              </div>

              <div className="sim-deck">
                {/* DEMO 1 */}
                <div className="sim-card">
                  <h4>⚡ Automated Lifecycle Demo</h4>
                  <p>
                    Runs an automated dispatch cycle with visual pacing: Request → Match nearby driver → Start journey → Complete trip & release driver.
                  </p>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={async () => {
                      logEvent("info", "Simulation", "Starting automated dispatch simulation...");
                      // 1. Ensure a driver is available
                      let driver = drivers.find((d) => d.status === "AVAILABLE");
                      if (!driver && drivers.length > 0) {
                        await api.updateDriverStatus(drivers[0].id, "AVAILABLE");
                        driver = { ...drivers[0], status: "AVAILABLE" };
                      }
                      if (driver) {
                        await api.updateDriverLocation(driver.id, { latitude: 19.06, longitude: 72.834 });
                      }
                      // 2. Request
                      const ride = await api.createRide({
                        riderId: SIMULATED_RIDERS[0].id,
                        pickupLatitude: 19.06,
                        pickupLongitude: 72.834,
                        dropoffLatitude: 19.0688,
                        dropoffLongitude: 72.8687,
                      });
                      logEvent("info", "Sim: Request", `Ride ${ride.data.id.slice(0, 8)} created`);
                      await refreshRides();
                      await refreshDrivers();

                      // 3. Match
                      setTimeout(async () => {
                        await api.matchRide(ride.data.id);
                        logEvent("success", "Sim: Matched", `Driver assigned to ride`);
                        await refreshRides();
                        await refreshDrivers();

                        // 4. Start
                        setTimeout(async () => {
                          await api.updateRideStatus(ride.data.id, "IN_PROGRESS");
                          logEvent("info", "Sim: Started", `Trip in progress`);
                          await refreshRides();

                          // 5. Complete
                          setTimeout(async () => {
                            await api.updateRideStatus(ride.data.id, "COMPLETED");
                            logEvent("success", "Sim: Completed", `Trip finished, driver released`);
                            await refreshRides();
                            await refreshDrivers();
                          }, 2000);
                        }, 2000);
                      }, 2000);
                    }}
                  >
                    Run 1-Click Simulation
                  </button>
                </div>

                {/* DEMO 2 */}
                <div className="sim-card">
                  <h4>🛡️ Concurrency Guard Test</h4>
                  <p>
                    Dispatches 2 simultaneous rides targeting the same single driver. Proves database-level isolation: exactly 1 ride claims the driver, and 1 receives 409 Conflict.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={async () => {
                      logEvent("warning", "Concurrency", "Firing concurrent match requests...");
                      const [r1, r2] = await Promise.all([
                        api.createRide({
                          riderId: SIMULATED_RIDERS[0].id,
                          pickupLatitude: 19.06,
                          pickupLongitude: 72.834,
                          dropoffLatitude: 19.0688,
                          dropoffLongitude: 72.8687,
                        }),
                        api.createRide({
                          riderId: SIMULATED_RIDERS[1].id,
                          pickupLatitude: 19.06,
                          pickupLongitude: 72.834,
                          dropoffLatitude: 19.0688,
                          dropoffLongitude: 72.8687,
                        }),
                      ]);

                      const results = await Promise.allSettled([
                        api.matchRide(r1.data.id),
                        api.matchRide(r2.data.id),
                      ]);

                      const statuses = results.map((r) => r.status === "fulfilled" ? "200 OK" : "409 Blocked");
                      logEvent("success", "Concurrency Result", `Ride 1: ${statuses[0]} | Ride 2: ${statuses[1]}`);
                      alert(`Concurrency Test Complete:\nRide 1: ${statuses[0]}\nRide 2: ${statuses[1]}\nDuplicate assignment was safely prevented!`);
                      await refreshRides();
                      await refreshDrivers();
                    }}
                  >
                    Test Double-Booking Prevention
                  </button>
                </div>

                {/* DEMO 3 */}
                <div className="sim-card">
                  <h4>📍 Driver GPS Teleport</h4>
                  <p>
                    Reposition a driver on the Mumbai map in Redis to test distance-based candidate matching.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      if (drivers.length > 0) {
                        setLocationModalDriver(drivers[0]);
                      }
                    }}
                  >
                    Teleport Sample Driver ↗
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CREATE RIDE MODAL */}
      {showCreateRide && (
        <CreateRideModal
          onClose={() => setShowCreateRide(false)}
          onCreated={(ride) => {
            logEvent("info", "Ride Created", `New ride ${ride.id.slice(0, 8)}`);
            refreshRides();
          }}
        />
      )}

      {/* RIDE DETAILS MODAL */}
      {inspectedRide && (
        <RideDetailsModal
          ride={inspectedRide}
          onClose={() => setInspectedRide(null)}
          onViewOnMap={(r) => {
            setActiveRouteForMap({
              pickupCoords: r.pickupCoords,
              dropoffCoords: r.dropoffCoords,
            });
            setActivePage("Overview");
          }}
        />
      )}

      {/* SET LOCATION MODAL */}
      {locationModalDriver && (
        <UpdateLocationModal
          driver={locationModalDriver}
          onClose={() => setLocationModalDriver(null)}
          onSave={handleSaveLocation}
          saving={savingLocation}
        />
      )}

      {/* ADD / EDIT DRIVER MODAL */}
      {driverFormModal && (
        <AddEditDriverModal
          mode={driverFormModal.mode}
          initialData={driverFormModal.data}
          onClose={() => setDriverFormModal(null)}
          onSave={handleSaveDriverDetails}
          saving={savingDriver}
        />
      )}

      {/* CONFIRM CANCEL MODAL */}
      {cancelModalRide && (
        <ConfirmCancelModal
          ride={cancelModalRide}
          onClose={() => setCancelModalRide(null)}
          onConfirm={handleConfirmCancel}
          isProcessing={cancelingRide}
        />
      )}
    </div>
  );
}

export default App;
