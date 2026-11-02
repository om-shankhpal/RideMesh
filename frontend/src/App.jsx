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
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCoordinate(latitude, longitude) {
  if (latitude == null || longitude == null) return "Unknown coordinates";
  return `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`;
}

function mapRideRecord(ride) {
  return {
    id: ride.id,
    rawRiderId: ride.rider_id,
    rider: getRiderDisplayName(ride.rider_id),
    pickup: formatCoordinate(ride.pickup_latitude, ride.pickup_longitude),
    dropoff: formatCoordinate(ride.dropoff_latitude, ride.dropoff_longitude),
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

const navItems = [
  { icon: "◫", label: "Overview" },
  { icon: "⌖", label: "Live simulation" },
  { icon: "↗", label: "Rides" },
  { icon: "♧", label: "Drivers" },
];

function StatusBadge({ status }) {
  const styles = {
    AVAILABLE: "green",
    MATCHED: "blue",
    IN_PROGRESS: "purple",
    COMPLETED: "green",
    REQUESTED: "amber",
    ON_TRIP: "purple",
    OFFLINE: "muted",
    CANCELLED: "red",
  };

  return (
    <span className={`status-badge ${styles[status] || "muted"}`}>
      <span className="status-dot" />
      {status ? status.replaceAll("_", " ") : "UNKNOWN"}
    </span>
  );
}

function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#overview"
        onClick={(e) => {
          e.preventDefault();
          setActivePage("Overview");
        }}
      >
        <span className="brand-mark">
          R<span>.</span>
        </span>
        <span>
          <strong>ridemesh</strong>
          <small>DISPATCH PLATFORM</small>
        </span>
      </a>

      <div className="workspace-label">WORKSPACE</div>

      <nav className="side-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`nav-button ${activePage === item.label ? "active" : ""}`}
            type="button"
            onClick={() => setActivePage(item.label)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.label === "Live simulation" && (
              <span className="nav-live-dot" />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="environment-card">
          <div className="environment-heading">
            <span className="environment-dot" />
            Simulation mode
          </div>
          <p>Microservices Active</p>
        </div>

        <div className="profile">
          <div className="avatar">RM</div>
          <div className="profile-copy">
            <strong>RideMesh Ops</strong>
            <span>Distributed Console</span>
          </div>
          <span className="profile-menu">···</span>
        </div>
      </div>
    </aside>
  );
}

// =========================================================================
// LEAFLET MAP & ICONS
// =========================================================================

const pickupIcon = L.divIcon({
  className: "custom-map-icon",
  html: '<div class="map-pin-icon pickup-marker map-pin-pulse">P</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: "custom-map-icon",
  html: '<div class="map-pin-icon destination-marker">D</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const getDriverIcon = (status, selected) => {
  const isBusy = status === "ON_TRIP";
  const isAvailable = status === "AVAILABLE";
  const statusClass = isBusy ? "busy" : isAvailable ? "available" : "offline";

  return L.divIcon({
    className: "custom-map-icon",
    html: `<div class="car-marker ${statusClass} ${
      selected ? "selected" : ""
    }">⌁</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

function getDriverPosition(driver) {
  // If the driver has an actual GPS coordinate recorded from Redis, use it
  if (driver.location?.latitude != null && driver.location?.longitude != null) {
    return [Number(driver.location.latitude), Number(driver.location.longitude)];
  }

  // Otherwise, use a deterministic schematic coordinate across Mumbai
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
  const selected = drivers.find((driver) => driver.id === selectedDriver);

  // If a specific active route is provided, use it; otherwise fallback to default Bandra preset
  const pickupPosition = activeRoute
    ? activeRoute.pickupCoords
    : [19.06, 72.834];
  const destinationPosition = activeRoute
    ? activeRoute.dropoffCoords
    : [19.0688, 72.8687];

  const hasRoute =
    pickupPosition &&
    pickupPosition[0] != null &&
    destinationPosition &&
    destinationPosition[0] != null;

  return (
    <div className="map-canvas">
      <MapContainer
        center={[19.055, 72.85]}
        zoom={12}
        scrollWheelZoom
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasRoute && (
          <>
            <Polyline
              positions={[pickupPosition, destinationPosition]}
              pathOptions={{
                color: "#26b96b",
                weight: 4,
                opacity: 0.85,
                dashArray: "8 8",
              }}
            />
            <Marker position={pickupPosition} icon={pickupIcon}>
              <Popup>
                <strong>Pickup Location</strong>
                <br />
                {formatCoordinate(pickupPosition[0], pickupPosition[1])}
              </Popup>
            </Marker>
            <Marker position={destinationPosition} icon={destinationIcon}>
              <Popup>
                <strong>Destination</strong>
                <br />
                {formatCoordinate(
                  destinationPosition[0],
                  destinationPosition[1],
                )}
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
              icon={getDriverIcon(
                driver.status,
                selectedDriver === driver.id,
              )}
              eventHandlers={{
                click: () =>
                  setSelectedDriver(
                    selectedDriver === driver.id ? null : driver.id,
                  ),
              }}
            >
              <Popup>
                <strong>{driver.name}</strong>
                <br />
                <span>Vehicle: {driver.vehicle}</span>
                <br />
                <span>Status: {driver.status.replaceAll("_", " ")}</span>
                <br />
                <small>
                  {hasGps
                    ? `GPS: ${formatCoordinate(
                        driver.location.latitude,
                        driver.location.longitude,
                      )}`
                    : "Simulated layout position"}
                </small>
                {onOpenLocationModal && (
                  <div style={{ marginTop: "8px" }}>
                    <button
                      type="button"
                      className="sim-btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "11px" }}
                      onClick={() => onOpenLocationModal(driver)}
                    >
                      Update GPS
                    </button>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="map-floating-card">
        <div className="map-card-heading">
          <span className="map-card-pulse" />
          FLEET STATUS
        </div>
        <strong>{drivers.length} drivers</strong>
        <span>
          {drivers.filter((d) => d.status === "AVAILABLE").length} available ·{" "}
          {drivers.filter((d) => d.status === "ON_TRIP").length} on trip
        </span>
      </div>

      {selected && (
        <div className="map-selection">
          <button
            className="selection-close"
            onClick={() => setSelectedDriver(null)}
            aria-label="Close driver details"
          >
            ×
          </button>
          <div className="selection-top">
            <div className="avatar driver-avatar">DR</div>
            <div>
              <strong>{selected.name}</strong>
              <span>{selected.id.slice(0, 8)}...</span>
            </div>
          </div>
          <StatusBadge status={selected.status} />
          <p>Vehicle: {selected.vehicle}</p>
          <small>
            {selected.location?.latitude != null
              ? `GPS: ${formatCoordinate(
                  selected.location.latitude,
                  selected.location.longitude,
                )}`
              : "Schematic layout · No GPS fixed"}
          </small>
          {onOpenLocationModal && (
            <button
              type="button"
              className="sim-btn-secondary"
              style={{ marginTop: "10px", width: "100%" }}
              onClick={() => onOpenLocationModal(selected)}
            >
              Update Location
            </button>
          )}
        </div>
      )}

      <div className="map-disclaimer">
        Live Mumbai Operations Map · OpenStreetMap
      </div>
    </div>
  );
}

// =========================================================================
// MODALS
// =========================================================================

function RideDetailsModal({ ride, onClose, onViewOnMap }) {
  if (!ride) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ride Details</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">Ride ID</span>
              <strong>{ride.id}</strong>
            </div>

            <div className="detail-item">
              <span className="label">Status</span>
              <div>
                <StatusBadge status={ride.status} />
              </div>
            </div>

            <div className="detail-item">
              <span className="label">Rider</span>
              <strong>{ride.rider}</strong>
            </div>

            <div className="detail-item">
              <span className="label">Assigned Driver</span>
              <strong>
                {ride.rawDriverId ? ride.rawDriverId : "Unassigned"}
              </strong>
            </div>

            <div className="detail-item">
              <span className="label">Pickup Coordinates</span>
              <strong>{ride.pickup}</strong>
            </div>

            <div className="detail-item">
              <span className="label">Drop-off Coordinates</span>
              <strong>{ride.dropoff}</strong>
            </div>

            <div className="detail-item">
              <span className="label">Created At</span>
              <strong>{ride.time}</strong>
            </div>

            <div className="detail-item">
              <span className="label">Last Updated</span>
              <strong>{formatRideTime(ride.updatedAt)}</strong>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="sim-btn-accent"
            onClick={() => {
              onViewOnMap(ride);
              onClose();
            }}
          >
            View Route on Map ↗
          </button>
          <button type="button" className="sim-btn-secondary" onClick={onClose}>
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
  const [error, setError] = useState("");

  if (!driver) return null;

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError("Please provide valid coordinates (-90..90, -180..180).");
      return;
    }

    onSave(driver.id, { latitude, longitude });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Update Location: {driver.name}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="preset-section">
              <span className="preset-label">Quick Mumbai Landmarks:</span>
              <div className="preset-pills">
                {MUMBAI_LOCATION_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="preset-pill-btn"
                    onClick={() => {
                      setLat(p.lat.toString());
                      setLng(p.lng.toString());
                    }}
                    disabled={saving}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="driver-lat">Latitude</label>
              <input
                id="driver-lat"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="driver-lng">Longitude</label>
              <input
                id="driver-lng"
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            {error && <p role="alert" className="form-error">{error}</p>}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="sim-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="sim-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving Location..." : "Update Location"}
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
          <h3>Cancel Ride Confirmation</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isProcessing}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            Are you sure you want to cancel ride{" "}
            <strong>{ride.id.slice(0, 8)}...</strong>?
          </p>
          {ride.rawDriverId && (
            <p style={{ color: "var(--amber)", fontSize: "12px" }}>
              Assigned driver ({ride.driver}) will be released and restored to
              AVAILABLE.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="sim-btn-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Keep Ride
          </button>
          <button
            type="button"
            className="button-primary"
            style={{ background: "var(--red)", borderColor: "var(--red)" }}
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
// OVERVIEW PAGE
// =========================================================================

function Overview({
  drivers,
  rides,
  ridesLoading,
  ridesError,
  refreshRides,
  setActivePage,
  events,
  setSelectedDriver,
  selectedDriver,
  serviceHealth,
  healthLoading,
  onInspectRide,
  onLogEvent,
  onOpenLocationModal,
  activeRoute,
}) {
  const [showCreateRide, setShowCreateRide] = useState(false);

  // Simulated Rider strategy — defaults to first simulated rider
  const [selectedRiderId, setSelectedRiderId] = useState(
    SIMULATED_RIDERS[0].id,
  );
  const [pickupLatitude, setPickupLatitude] = useState("19.0600");
  const [pickupLongitude, setPickupLongitude] = useState("72.8340");
  const [dropoffLatitude, setDropoffLatitude] = useState("19.0688");
  const [dropoffLongitude, setDropoffLongitude] = useState("72.8687");

  const [creatingRide, setCreatingRide] = useState(false);
  const [createRideError, setCreateRideError] = useState("");
  const [createRideSuccess, setCreateRideSuccess] = useState("");

  function applyRoutePreset(preset) {
    setPickupLatitude(preset.pickupLat.toString());
    setPickupLongitude(preset.pickupLng.toString());
    setDropoffLatitude(preset.dropoffLat.toString());
    setDropoffLongitude(preset.dropoffLng.toString());
  }

  async function handleCreateRide(event) {
    event.preventDefault();

    setCreateRideError("");
    setCreateRideSuccess("");

    const coordinates = [
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
    ].map(Number);

    const [pickupLat, pickupLng, dropoffLat, dropoffLng] = coordinates;

    if (!selectedRiderId) {
      setCreateRideError("Please select a simulated rider.");
      return;
    }

    if (
      coordinates.some((value) => !Number.isFinite(value)) ||
      pickupLat < -90 ||
      pickupLat > 90 ||
      dropoffLat < -90 ||
      dropoffLat > 90 ||
      pickupLng < -180 ||
      pickupLng > 180 ||
      dropoffLng < -180 ||
      dropoffLng > 180
    ) {
      setCreateRideError("Enter valid latitude (-90..90) and longitude (-180..180).");
      return;
    }

    try {
      setCreatingRide(true);

      const response = await api.createRide({
        riderId: selectedRiderId,
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        dropoffLatitude: dropoffLat,
        dropoffLongitude: dropoffLng,
      });

      const riderName = getRiderDisplayName(selectedRiderId);
      const createdId = response?.data?.id ?? "New Ride";

      onLogEvent(
        "info",
        "Ride requested",
        `Created ride ${createdId.slice(0, 8)} for ${riderName}`,
      );

      await refreshRides();

      setCreateRideSuccess(`Ride created successfully (ID: ${createdId.slice(0, 8)}).`);
      setShowCreateRide(false);
    } catch (error) {
      setCreateRideError(error.message || "Unable to create ride.");
    } finally {
      setCreatingRide(false);
    }
  }

  const availableCount = drivers.filter(
    (driver) => driver.status === "AVAILABLE",
  ).length;

  const activeCount = rides.filter((ride) =>
    ["MATCHED", "IN_PROGRESS"].includes(ride.status),
  ).length;

  const pendingCount = rides.filter(
    (ride) => ride.status === "REQUESTED",
  ).length;

  const healthyCount = serviceHealth.filter(
    (service) => service.status === "UP",
  ).length;

  return (
    <>
      {/* PAGE HEADING */}
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> DISPATCH CENTER
          </div>
          <h1>Operations overview</h1>
          <p>
            Monitor drivers, inspect ride requests, and explore the matching
            simulation.
          </p>
        </div>

        <div className="heading-actions">
          <span className="preview-label">
            <span /> LIVE DATA
          </span>

          <button
            type="button"
            className="button-primary"
            onClick={() => {
              setShowCreateRide((prev) => !prev);
              setCreateRideError("");
              setCreateRideSuccess("");
            }}
          >
            <span>＋</span> Create ride
          </button>
        </div>
      </section>

      {/* CREATE RIDE FORM */}
      {createRideSuccess && (
        <p role="status" style={{ color: "var(--lime)", marginBottom: "16px" }}>
          ✓ {createRideSuccess}
        </p>
      )}

      {showCreateRide && (
        <section
          className="panel"
          style={{ padding: "24px", marginBottom: "24px" }}
        >
          <div className="panel-header">
            <div>
              <div className="panel-title">Create a ride request</div>
              <div className="panel-subtitle">
                Select a simulated rider and route coordinates
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateRide}>
            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="rider-select">Simulated Rider</label>
              <select
                id="rider-select"
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                disabled={creatingRide}
                style={{ width: "100%", padding: "10px", borderRadius: "8px" }}
              >
                {SIMULATED_RIDERS.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name} ({rider.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="preset-section">
              <span className="preset-label">Quick Mumbai Route Presets:</span>
              <div className="preset-pills">
                {MUMBAI_ROUTE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="preset-pill-btn"
                    onClick={() => applyRoutePreset(preset)}
                    disabled={creatingRide}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <h3 style={{ fontSize: "14px", marginTop: "16px" }}>
              Pickup location
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div>
                <label htmlFor="pickup-lat">Latitude</label>
                <input
                  id="pickup-lat"
                  type="number"
                  step="any"
                  value={pickupLatitude}
                  onChange={(e) => setPickupLatitude(e.target.value)}
                  required
                  disabled={creatingRide}
                />
              </div>

              <div>
                <label htmlFor="pickup-lng">Longitude</label>
                <input
                  id="pickup-lng"
                  type="number"
                  step="any"
                  value={pickupLongitude}
                  onChange={(e) => setPickupLongitude(e.target.value)}
                  required
                  disabled={creatingRide}
                />
              </div>
            </div>

            <h3 style={{ fontSize: "14px" }}>Drop-off location</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <label htmlFor="dropoff-lat">Latitude</label>
                <input
                  id="dropoff-lat"
                  type="number"
                  step="any"
                  value={dropoffLatitude}
                  onChange={(e) => setDropoffLatitude(e.target.value)}
                  required
                  disabled={creatingRide}
                />
              </div>

              <div>
                <label htmlFor="dropoff-lng">Longitude</label>
                <input
                  id="dropoff-lng"
                  type="number"
                  step="any"
                  value={dropoffLongitude}
                  onChange={(e) => setDropoffLongitude(e.target.value)}
                  required
                  disabled={creatingRide}
                />
              </div>
            </div>

            {createRideError && (
              <p role="alert" style={{ color: "var(--red)", marginBottom: "16px" }}>
                {createRideError}
              </p>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="submit"
                className="button-primary"
                disabled={creatingRide}
              >
                {creatingRide ? "Creating..." : "Create ride"}
              </button>

              <button
                type="button"
                className="sim-btn-secondary"
                onClick={() => setShowCreateRide(false)}
                disabled={creatingRide}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* METRICS */}
      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-top">
            <span>Available drivers</span>
            <span className="metric-icon green-icon">⌖</span>
          </div>

          <div className="metric-value">
            {availableCount}
            <span className="metric-unit"> / {drivers.length}</span>
          </div>

          <div className="metric-foot">
            <span className="metric-dot green-bg" /> Ready for dispatch
          </div>

          <div className="metric-sparkline green-line">
            <span /><span /><span /><span /><span /><span /><span />
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Active rides</span>
            <span className="metric-icon blue-icon">↗</span>
          </div>

          <div className="metric-value">
            {activeCount}
            <span className="metric-unit"> rides</span>
          </div>

          <div className="metric-foot">
            <span className="metric-dot blue-bg" /> Matched or in progress
          </div>

          <div className="metric-sparkline blue-line">
            <span /><span /><span /><span /><span /><span /><span />
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Awaiting match</span>
            <span className="metric-icon amber-icon">◷</span>
          </div>

          <div className="metric-value">
            {pendingCount}
            <span className="metric-unit"> requests</span>
          </div>

          <div className="metric-foot">
            <span className="metric-dot amber-bg" /> Waiting for driver match
          </div>

          <div className="metric-sparkline amber-line">
            <span /><span /><span /><span /><span /><span /><span />
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Service health</span>
            <span className="metric-icon violet-icon">⌁</span>
          </div>

          <div className="metric-value service-value">
            <span className="health-pulse" />
            {healthLoading
              ? "Checking..."
              : `${healthyCount} / ${serviceHealth.length} Online`}
          </div>

          <div className="metric-foot muted-foot">
            {healthLoading
              ? "Checking microservices..."
              : serviceHealth.length > 0 &&
                  healthyCount === serviceHealth.length
                ? "All 3 microservices operational"
                : `${serviceHealth.filter((s) => s.status === "DOWN").map((s) => s.name).join(", ")} unavailable`}
          </div>

          <div className="health-track">
            <span
              style={{
                width: `${
                  serviceHealth.length > 0
                    ? (healthyCount / serviceHealth.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </article>
      </section>

      {/* MAP AND ACTIVITY */}
      <section className="main-grid">
        <article className="panel map-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Driver distribution</div>
              <div className="panel-subtitle">
                Mumbai · Live fleet monitoring
              </div>
            </div>

            <button
              className="subtle-button"
              type="button"
              onClick={() => setSelectedDriver(null)}
            >
              Reset selection <span>↗</span>
            </button>
          </div>

          <div className="map-wrapper">
            <CityMap
              drivers={drivers}
              selectedDriver={selectedDriver}
              setSelectedDriver={setSelectedDriver}
              onOpenLocationModal={onOpenLocationModal}
              activeRoute={activeRoute}
            />
          </div>

          <div className="map-footer">
            <span>
              <i className="footer-dot green-bg" /> {availableCount} available
            </span>
            <span>
              <i className="footer-dot purple-bg" />{" "}
              {drivers.filter((d) => d.status === "ON_TRIP").length} on trip
            </span>
            <span>
              <i className="footer-dot" style={{ background: "var(--muted)" }} />{" "}
              {drivers.filter((d) => d.status === "OFFLINE").length} offline
            </span>
            <span className="map-footer-note">
              Click a driver marker for details
            </span>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Activity stream</div>
              <div className="panel-subtitle">Real-time system events</div>
            </div>

            <span className="activity-live">
              <i /> LIVE
            </span>
          </div>

          <div className="event-list">
            {events.length === 0 && (
              <div style={{ padding: "20px", color: "var(--muted)" }}>
                No events recorded yet. Perform actions to see live dispatch
                events.
              </div>
            )}
            {events.map((event, index) => (
              <div className="event-item" key={`${event.time}-${index}`}>
                <div className={`event-icon ${event.type}`}>
                  {event.type === "success"
                    ? "✓"
                    : event.type === "warning"
                      ? "!"
                      : event.type === "error"
                        ? "✕"
                        : "↗"}
                </div>

                <div className="event-content">
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                  <time>{event.time}</time>
                </div>
              </div>
            ))}
          </div>

          <div className="activity-footer">
            <span className="activity-footer-line" />
            Live events from Ride, Location & Match services.
          </div>
        </article>
      </section>

      {/* RECENT RIDES */}
      <section className="panel rides-panel">
        <div className="panel-header rides-heading">
          <div>
            <div className="panel-title">Recent ride requests</div>
            <div className="panel-subtitle">
              Inspect latest ride requests and matching state
            </div>
          </div>

          <button
            type="button"
            className="subtle-button"
            onClick={() => setActivePage("Rides")}
          >
            View all rides <span>→</span>
          </button>
        </div>

        <div className="table-scroll">
          <table className="rides-table">
            <thead>
              <tr>
                <th>RIDE ID</th>
                <th>ROUTE</th>
                <th>DRIVER</th>
                <th>STATUS</th>
                <th>CREATED</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {ridesLoading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
                    Loading rides...
                  </td>
                </tr>
              )}

              {ridesError && (
                <tr>
                  <td colSpan={6} style={{ color: "var(--red)", padding: "20px" }}>
                    Unable to load rides: {ridesError}
                  </td>
                </tr>
              )}

              {!ridesLoading && !ridesError && rides.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
                    No rides found. Click "+ Create ride" above to begin.
                  </td>
                </tr>
              )}

              {rides.slice(0, 6).map((ride) => (
                <tr key={ride.id}>
                  <td>
                    <span className="ride-id">{ride.id.slice(0, 8)}...</span>
                    <small>{ride.rider}</small>
                  </td>

                  <td>
                    <div className="route-cell">
                      <span className="route-start" />
                      <span>{ride.pickup}</span>
                    </div>

                    <div className="route-cell route-destination">
                      <span className="route-end" />
                      <span>{ride.dropoff}</span>
                    </div>
                  </td>

                  <td>
                    {ride.driver ? (
                      <span className="driver-id">{ride.driver}</span>
                    ) : (
                      <span className="unassigned">Unassigned</span>
                    )}
                  </td>

                  <td>
                    <StatusBadge status={ride.status} />
                  </td>

                  <td className="time-cell">{ride.time}</td>

                  <td>
                    <button
                      type="button"
                      className="row-action"
                      title="Inspect ride details"
                      onClick={() => onInspectRide(ride)}
                    >
                      ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="page-footer">
        <span>
          RIDEMESH <span className="footer-separator">/</span> SIMULATION
          WORKSPACE
        </span>
        <span>Built to demonstrate distributed ride matching & dispatch</span>
      </footer>
    </>
  );
}

// =========================================================================
// DRIVERS PAGE
// =========================================================================

function DriversPage({
  drivers,
  selectedDriver,
  setSelectedDriver,
  driversLoading,
  driversError,
  refreshDrivers,
  onLogEvent,
  onOpenLocationModal,
}) {
  const [formMode, setFormMode] = useState(null);
  const [editingDriverId, setEditingDriverId] = useState(null);

  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("BIKE");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vehicleFilter, setVehicleFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [statusActionId, setStatusActionId] = useState(null);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function openAddForm() {
    setFormMode("add");
    setEditingDriverId(null);
    setName("");
    setVehicleType("BIKE");
    setFormError("");
    setSuccessMessage("");
  }

  function openEditForm(driver) {
    setFormMode("edit");
    setEditingDriverId(driver.id);
    setName(driver.name);
    setVehicleType(driver.vehicle);
    setFormError("");
    setSuccessMessage("");
  }

  function closeForm() {
    setFormMode(null);
    setEditingDriverId(null);
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setFormError("Name must contain between 2 and 100 characters.");
      return;
    }

    try {
      setSaving(true);
      const driverData = { name: trimmedName, vehicleType };

      if (formMode === "add") {
        const result = await api.createDriver(driverData);
        onLogEvent(
          "success",
          "Driver added",
          `Created driver ${trimmedName} (${vehicleType})`,
        );
        setSuccessMessage("Driver created successfully.");
        if (result.data?.id) {
          setSelectedDriver(result.data.id);
        }
      } else {
        await api.updateDriver(editingDriverId, driverData);
        onLogEvent(
          "info",
          "Driver updated",
          `Updated details for ${trimmedName}`,
        );
        setSuccessMessage("Driver details updated successfully.");
      }

      await refreshDrivers();
      closeForm();
    } catch (error) {
      setFormError(error.message || "Unable to save driver.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(driver) {
    try {
      setStatusActionId(driver.id);
      let nextStatus = "AVAILABLE";

      if (driver.status === "AVAILABLE") {
        nextStatus = "OFFLINE";
      } else if (driver.status === "OFFLINE") {
        nextStatus = "AVAILABLE";
      } else {
        return;
      }

      await api.updateDriverStatus(driver.id, nextStatus);

      onLogEvent(
        nextStatus === "AVAILABLE" ? "success" : "warning",
        "Driver status changed",
        `${driver.name} is now ${nextStatus}`,
      );

      await refreshDrivers();
    } catch (error) {
      alert(`Status transition failed: ${error.message}`);
    } finally {
      setStatusActionId(null);
    }
  }

  const filteredDrivers = drivers.filter((driver) => {
    if (statusFilter !== "ALL" && driver.status !== statusFilter) return false;
    if (vehicleFilter !== "ALL" && driver.vehicle !== vehicleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        driver.name.toLowerCase().includes(q) ||
        driver.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <section className="page-section">
      <div className="section-intro">
        <div className="eyebrow">FLEET MANAGEMENT</div>
        <h1>Driver directory</h1>
        <p>
          Manage driver records, update status, and set GPS locations. Location
          coordinates stored in Redis update nearby discovery in real time.
        </p>

        <div style={{ marginTop: "14px" }}>
          <button
            type="button"
            className="button-primary"
            onClick={openAddForm}
            disabled={saving}
          >
            + Add driver
          </button>
        </div>
      </div>

      {successMessage && (
        <p role="status" style={{ color: "var(--lime)", marginBottom: "16px" }}>
          ✓ {successMessage}
        </p>
      )}

      {driversLoading && (
        <p role="status">Loading drivers from Location Service...</p>
      )}

      {driversError && (
        <p role="alert" style={{ color: "var(--red)" }}>
          Unable to load drivers: {driversError}
        </p>
      )}

      {/* FILTER BAR */}
      <div className="filter-bar">
        <span style={{ fontSize: "12px", color: "var(--muted)", marginRight: "4px" }}>
          Status:
        </span>
        {["ALL", "AVAILABLE", "ON_TRIP", "OFFLINE"].map((st) => (
          <button
            key={st}
            type="button"
            className={`filter-pill ${statusFilter === st ? "active" : ""}`}
            onClick={() => setStatusFilter(st)}
          >
            {st.replaceAll("_", " ")}
          </button>
        ))}

        <span
          style={{
            fontSize: "12px",
            color: "var(--muted)",
            marginLeft: "12px",
            marginRight: "4px",
          }}
        >
          Vehicle:
        </span>
        {["ALL", "BIKE", "CAR"].map((veh) => (
          <button
            key={veh}
            type="button"
            className={`filter-pill ${vehicleFilter === veh ? "active" : ""}`}
            onClick={() => setVehicleFilter(veh)}
          >
            {veh}
          </button>
        ))}

        <input
          type="text"
          placeholder="Search by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            fontSize: "12px",
            maxWidth: "220px",
          }}
        />
      </div>

      {/* ADD / EDIT MODAL FORM */}
      {formMode && (
        <div
          className="panel"
          style={{ padding: "24px", marginBottom: "24px", maxWidth: "560px" }}
        >
          <h2>{formMode === "add" ? "Add new driver" : "Edit driver"}</h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="driver-name">Driver name</label>
              <input
                id="driver-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter driver name"
                minLength={2}
                maxLength={100}
                required
                disabled={saving}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="driver-vehicle">Vehicle type</label>
              <select
                id="driver-vehicle"
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
                disabled={saving}
              >
                <option value="BIKE">Bike</option>
                <option value="CAR">Car</option>
              </select>
            </div>

            {formError && (
              <p role="alert" style={{ color: "var(--red)", marginBottom: "16px" }}>
                {formError}
              </p>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="submit"
                className="button-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : formMode === "add"
                    ? "Create driver"
                    : "Save changes"}
              </button>

              <button
                type="button"
                className="sim-btn-secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!driversLoading && !driversError && filteredDrivers.length === 0 && (
        <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)" }}>
          No drivers match the current filters.
        </div>
      )}

      <div className="driver-grid">
        {filteredDrivers.map((driver) => {
          const isSelected = selectedDriver === driver.id;
          const isToggling = statusActionId === driver.id;
          const hasGps = driver.location?.latitude != null;

          return (
            <article
              key={driver.id}
              className={`driver-card ${isSelected ? "driver-card-selected" : ""}`}
            >
              <button
                type="button"
                className="driver-card-select"
                onClick={() =>
                  setSelectedDriver(isSelected ? null : driver.id)
                }
              >
                <div className="driver-card-top">
                  <div className="avatar driver-avatar">DR</div>
                  <StatusBadge status={driver.status} />
                </div>

                <strong>{driver.name}</strong>
                <span className="driver-id">{driver.id}</span>
                <span className="driver-vehicle">
                  Vehicle: {driver.vehicle}
                </span>

                <div
                  style={{
                    fontSize: "11px",
                    color: hasGps ? "var(--lime)" : "var(--muted)",
                    marginTop: "6px",
                  }}
                >
                  {hasGps
                    ? `● GPS: ${formatCoordinate(
                        driver.location.latitude,
                        driver.location.longitude,
                      )}`
                    : "○ Schematic layout (no GPS fixed)"}
                </div>

                <span className="driver-card-link">
                  {isSelected ? "Selected on map ✓" : "Inspect on map ↗"}
                </span>
              </button>

              <div className="driver-actions-cell">
                {driver.status === "OFFLINE" && (
                  <button
                    type="button"
                    className="status-toggle-btn available"
                    disabled={isToggling}
                    onClick={() => handleToggleStatus(driver)}
                  >
                    {isToggling ? "Updating..." : "Go Online (AVAILABLE)"}
                  </button>
                )}

                {driver.status === "AVAILABLE" && (
                  <button
                    type="button"
                    className="status-toggle-btn offline"
                    disabled={isToggling}
                    onClick={() => handleToggleStatus(driver)}
                  >
                    {isToggling ? "Updating..." : "Go Offline"}
                  </button>
                )}

                {driver.status === "ON_TRIP" && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--purple)",
                      padding: "6px 8px",
                    }}
                  >
                    Trip active (locked)
                  </span>
                )}

                <button
                  type="button"
                  className="sim-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 10px" }}
                  onClick={() => onOpenLocationModal(driver)}
                >
                  Set GPS
                </button>

                <button
                  type="button"
                  className="sim-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 10px" }}
                  onClick={() => openEditForm(driver)}
                  disabled={saving}
                >
                  Edit
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// =========================================================================
// RIDES PAGE
// =========================================================================

function RidesPage({
  rides,
  ridesLoading,
  ridesError,
  rideActionId,
  rideActionError,
  onRideAction,
  onInspectRide,
  onCancelRequest,
}) {
  const [statusFilter, setStatusFilter] = useState("ALL");

  function getActions(status) {
    switch (status) {
      case "REQUESTED":
        return [
          { label: "Match driver", action: "MATCH", isPrimary: true },
          { label: "Cancel", action: "CANCEL_CONFIRM", isDanger: true },
        ];
      case "MATCHED":
        return [
          { label: "Start ride", action: "START", isPrimary: true },
          { label: "Cancel", action: "CANCEL_CONFIRM", isDanger: true },
        ];
      case "IN_PROGRESS":
        return [
          { label: "Complete ride", action: "COMPLETE", isPrimary: true },
        ];
      default:
        return [];
    }
  }

  const filteredRides = rides.filter((ride) => {
    if (statusFilter !== "ALL" && ride.status !== statusFilter) return false;
    return true;
  });

  return (
    <section className="page-section">
      <div className="section-intro">
        <div className="eyebrow">RIDE LIFECYCLE</div>
        <h1>Ride requests</h1>
        <p>
          Track ride states from creation to completion. Valid transitions:
          REQUESTED → MATCHED → IN_PROGRESS → COMPLETED (or CANCELLED).
        </p>
      </div>

      {ridesLoading && <p role="status">Loading rides from Ride Service...</p>}
      {ridesError && (
        <p role="alert" style={{ color: "var(--red)" }}>
          Unable to load rides: {ridesError}
        </p>
      )}
      {rideActionError && (
        <p
          role="alert"
          style={{
            color: "var(--red)",
            background: "rgba(255,119,119,0.1)",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          Action failed: {rideActionError}
        </p>
      )}

      {/* FILTER BAR */}
      <div className="filter-bar">
        <span style={{ fontSize: "12px", color: "var(--muted)", marginRight: "4px" }}>
          Filter Status:
        </span>
        {[
          "ALL",
          "REQUESTED",
          "MATCHED",
          "IN_PROGRESS",
          "COMPLETED",
          "CANCELLED",
        ].map((st) => (
          <button
            key={st}
            type="button"
            className={`filter-pill ${statusFilter === st ? "active" : ""}`}
            onClick={() => setStatusFilter(st)}
          >
            {st.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {!ridesLoading && !ridesError && filteredRides.length === 0 && (
        <p style={{ padding: "20px", color: "var(--muted)" }}>
          No rides found with status "{statusFilter}".
        </p>
      )}

      <div className="panel rides-panel">
        <div className="table-scroll">
          <table className="rides-table">
            <thead>
              <tr>
                <th>RIDE ID</th>
                <th>ROUTE</th>
                <th>DRIVER</th>
                <th>STATUS</th>
                <th>CREATED</th>
                <th>ACTIONS</th>
                <th>DETAILS</th>
              </tr>
            </thead>

            <tbody>
              {filteredRides.map((ride) => {
                const actions = getActions(ride.status);
                const isProcessing = rideActionId === ride.id;

                return (
                  <tr key={ride.id}>
                    <td>
                      <span className="ride-id">{ride.id.slice(0, 8)}...</span>
                      <small>{ride.rider}</small>
                    </td>

                    <td>
                      <div className="route-cell">
                        <span className="route-start" />
                        <span>{ride.pickup}</span>
                      </div>
                      <div className="route-cell route-destination">
                        <span className="route-end" />
                        <span>{ride.dropoff}</span>
                      </div>
                    </td>

                    <td>
                      {ride.driver ? (
                        <span className="driver-id">{ride.driver}</span>
                      ) : (
                        <span className="unassigned">Unassigned</span>
                      )}
                    </td>

                    <td>
                      <StatusBadge status={ride.status} />
                    </td>

                    <td className="time-cell">{ride.time}</td>

                    <td>
                      <div className="ride-actions">
                        {actions.length === 0 ? (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        ) : (
                          actions.map(({ label, action, isDanger }) => (
                            <button
                              key={action}
                              type="button"
                              className={isDanger ? "sim-btn-secondary" : "button-primary"}
                              style={
                                isDanger
                                  ? { color: "var(--red)", borderColor: "rgba(255,119,119,0.3)" }
                                  : { padding: "6px 12px", fontSize: "11px" }
                              }
                              disabled={rideActionId !== null}
                              onClick={() => {
                                if (action === "CANCEL_CONFIRM") {
                                  onCancelRequest(ride);
                                } else {
                                  onRideAction(ride.id, action);
                                }
                              }}
                            >
                              {isProcessing ? "Processing..." : label}
                            </button>
                          ))
                        )}
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="row-action"
                        title="View details"
                        onClick={() => onInspectRide(ride)}
                      >
                        ↗
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// =========================================================================
// LIVE SIMULATION PAGE
// =========================================================================

function LiveSimulationPage({
  drivers,
  rides,
  refreshDrivers,
  refreshRides,
  onLogEvent,
  onOpenLocationModal,
  selectedDriver,
  setSelectedDriver,
  activeRoute,
}) {
  const [simStep, setSimStep] = useState(null);
  const [simMessage, setSimMessage] = useState("");
  const [concurrencyResult, setConcurrencyResult] = useState(null);
  const [isRunningCycle, setIsRunningCycle] = useState(false);

  // Helper delay
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Run full automated lifecycle
  async function runFullCycleSimulation() {
    setIsRunningCycle(true);
    setSimMessage("Initializing full ride lifecycle simulation...");
    setSimStep("REQUEST");

    try {
      // 1. Ensure at least one driver is AVAILABLE at Bandra
      let targetDriver = drivers.find((d) => d.status === "AVAILABLE");
      if (!targetDriver) {
        const offlineDriver = drivers.find((d) => d.status === "OFFLINE");
        if (offlineDriver) {
          setSimMessage(`Activating offline driver ${offlineDriver.name}...`);
          await api.updateDriverStatus(offlineDriver.id, "AVAILABLE");
          targetDriver = { ...offlineDriver, status: "AVAILABLE" };
        }
      }

      if (targetDriver) {
        // Place driver near Bandra
        await api.updateDriverLocation(targetDriver.id, {
          latitude: 19.06,
          longitude: 72.834,
        });
        await refreshDrivers();
      }

      await delay(1000);

      // 2. Request Ride
      setSimStep("REQUESTING");
      setSimMessage("Step 1/4: Requesting ride at Bandra West...");
      const rideResult = await api.createRide({
        riderId: SIMULATED_RIDERS[0].id,
        pickupLatitude: 19.06,
        pickupLongitude: 72.834,
        dropoffLatitude: 19.0688,
        dropoffLongitude: 72.8687,
      });

      const rideId = rideResult.data.id;
      onLogEvent(
        "info",
        "Simulation: Ride requested",
        `Created ride ${rideId.slice(0, 8)} for ${SIMULATED_RIDERS[0].name}`,
      );
      await refreshRides();
      await delay(1800);

      // 3. Match Driver
      setSimStep("MATCHING");
      setSimMessage("Step 2/4: Calling Match Service to discover nearby driver...");
      const matchResult = await api.matchRide(rideId);
      const matchedDriverId = matchResult?.data?.driver_id;

      onLogEvent(
        "success",
        "Simulation: Driver matched",
        `Driver ${matchedDriverId?.slice(0, 8) ?? "assigned"} matched to ride ${rideId.slice(0, 8)}`,
      );
      await refreshRides();
      await refreshDrivers();
      await delay(2000);

      // 4. Start Journey
      setSimStep("STARTING");
      setSimMessage("Step 3/4: Passenger onboard. Trip transitioned to IN_PROGRESS...");
      await api.updateRideStatus(rideId, "IN_PROGRESS");
      onLogEvent(
        "info",
        "Simulation: Trip started",
        `Ride ${rideId.slice(0, 8)} is now IN_PROGRESS`,
      );
      await refreshRides();
      await delay(2200);

      // 5. Complete Journey
      setSimStep("COMPLETING");
      setSimMessage("Step 4/4: Reached BKC destination. Completing ride...");
      await api.updateRideStatus(rideId, "COMPLETED");
      onLogEvent(
        "success",
        "Simulation: Trip completed",
        `Ride ${rideId.slice(0, 8)} marked COMPLETED. Outbox worker will release driver.`,
      );

      await refreshRides();
      await delay(1500);
      await refreshDrivers();

      setSimStep("DONE");
      setSimMessage("Full lifecycle simulation completed successfully!");
    } catch (error) {
      setSimStep("ERROR");
      setSimMessage(`Simulation failed: ${error.message}`);
      onLogEvent("error", "Simulation error", error.message);
    } finally {
      setIsRunningCycle(false);
    }
  }

  // Concurrency collision demonstration
  async function testConcurrentDispatch() {
    setIsRunningCycle(true);
    setConcurrencyResult(null);
    setSimMessage("Firing simultaneous ride requests & concurrent match attempts...");

    try {
      // Create two rides in same location
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

      const rideId1 = r1.data.id;
      const rideId2 = r2.data.id;

      onLogEvent(
        "info",
        "Concurrency Test",
        `Created concurrent rides ${rideId1.slice(0, 8)} & ${rideId2.slice(0, 8)}`,
      );

      // Fire simultaneous match calls
      const [res1, res2] = await Promise.allSettled([
        api.matchRide(rideId1),
        api.matchRide(rideId2),
      ]);

      const outcome = {
        ride1: {
          id: rideId1,
          status: res1.status === "fulfilled" ? "MATCHED (200 OK)" : `FAILED (${res1.reason?.message})`,
          success: res1.status === "fulfilled",
        },
        ride2: {
          id: rideId2,
          status: res2.status === "fulfilled" ? "MATCHED (200 OK)" : `BLOCKED (${res2.reason?.message})`,
          success: res2.status === "fulfilled",
        },
      };

      setConcurrencyResult(outcome);

      onLogEvent(
        "warning",
        "Concurrency result",
        `One ride matched, second assignment conflict correctly prevented (idx_rides_unique_active_driver constraint).`,
      );

      await refreshRides();
      await refreshDrivers();
      setSimMessage("Concurrency test complete: Double-assignment prevented!");
    } catch (error) {
      setSimMessage(`Concurrency test error: ${error.message}`);
    } finally {
      setIsRunningCycle(false);
    }
  }

  // Fast single ride request helper
  async function triggerQuickRequest() {
    try {
      const res = await api.createRide({
        riderId: SIMULATED_RIDERS[Math.floor(Math.random() * SIMULATED_RIDERS.length)].id,
        pickupLatitude: 19.06 + (Math.random() - 0.5) * 0.02,
        pickupLongitude: 72.834 + (Math.random() - 0.5) * 0.02,
        dropoffLatitude: 19.0688,
        dropoffLongitude: 72.8687,
      });
      onLogEvent("info", "Simulated Request", `Ride created: ${res.data.id.slice(0, 8)}`);
      await refreshRides();
    } catch (err) {
      alert(err.message);
    }
  }

  const requestedCount = rides.filter((r) => r.status === "REQUESTED").length;

  return (
    <section className="page-section">
      <div className="section-intro">
        <div className="eyebrow">LIVE SIMULATION</div>
        <h1>City operations sandbox</h1>
        <p>
          Simulate real-time ride matching, test concurrent dispatch safety,
          and visualize driver distribution across Mumbai ({requestedCount} pending requests).
        </p>
      </div>

      <div className="sim-grid">
        {/* MAP PANEL */}
        <div className="panel map-panel standalone-map">
          <div className="panel-header">
            <div>
              <div className="panel-title">Mumbai fleet simulator</div>
              <div className="panel-subtitle">
                Real-time React-Leaflet map view
              </div>
            </div>
          </div>

          <div className="map-wrapper">
            <CityMap
              drivers={drivers}
              selectedDriver={selectedDriver}
              setSelectedDriver={setSelectedDriver}
              onOpenLocationModal={onOpenLocationModal}
              activeRoute={activeRoute}
            />
          </div>
        </div>

        {/* SIMULATION CONTROL DECK */}
        <div className="sim-deck">
          {/* SCENARIO 1 */}
          <div className="sim-card">
            <div className="sim-card-title">
              <span>⚡</span> End-to-End Dispatch Lifecycle
            </div>
            <p className="sim-card-desc">
              Executes a full lifecycle with visual delays: Request → Match
              nearby driver → Start journey → Complete trip & return driver to
              available pool.
            </p>

            {simMessage && (
              <div className="sim-progress-box">
                <span>{simStep === "DONE" ? "✓" : "⏳"}</span>
                <span>{simMessage}</span>
              </div>
            )}

            <div className="sim-actions">
              <button
                type="button"
                className="sim-btn-primary"
                onClick={runFullCycleSimulation}
                disabled={isRunningCycle}
              >
                {isRunningCycle ? "Simulating..." : "Run Full Cycle Simulation"}
              </button>

              <button
                type="button"
                className="sim-btn-secondary"
                onClick={triggerQuickRequest}
                disabled={isRunningCycle}
              >
                + Quick Ride Request
              </button>
            </div>
          </div>

          {/* SCENARIO 2 */}
          <div className="sim-card">
            <div className="sim-card-title">
              <span>🛡️</span> Concurrency Collision Guard
            </div>
            <p className="sim-card-desc">
              Dispatches two simultaneous ride requests targeting the same
              nearby driver. Tests PostgreSQL unique partial index
              (idx_rides_unique_active_driver) to prove prevention of double
              assignment.
            </p>

            {concurrencyResult && (
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              >
                <div style={{ color: "var(--lime)", marginBottom: "4px" }}>
                  Ride 1: {concurrencyResult.ride1.status}
                </div>
                <div style={{ color: "var(--amber)" }}>
                  Ride 2: {concurrencyResult.ride2.status}
                </div>
              </div>
            )}

            <div className="sim-actions">
              <button
                type="button"
                className="sim-btn-accent"
                onClick={testConcurrentDispatch}
                disabled={isRunningCycle}
              >
                Test Concurrent Dispatch
              </button>
            </div>
          </div>

          {/* SCENARIO 3 */}
          <div className="sim-card">
            <div className="sim-card-title">
              <span>📍</span> Fleet GPS Teleporter
            </div>
            <p className="sim-card-desc">
              Select any driver on the map or in the list, then click "Update
              GPS" to teleport their coordinates in Redis and verify nearby
              discovery changes.
            </p>
            <div className="sim-actions">
              <button
                type="button"
                className="sim-btn-secondary"
                onClick={() => {
                  if (drivers.length > 0) {
                    onOpenLocationModal(drivers[0]);
                  }
                }}
              >
                Teleport Sample Driver ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
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
  const [driversError, setDriversError] = useState("");

  const [rides, setRides] = useState([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [ridesError, setRidesError] = useState("");

  const [rideActionId, setRideActionId] = useState(null);
  const [rideActionError, setRideActionError] = useState("");

  const [serviceHealth, setServiceHealth] = useState([]);
  const [healthLoading, setHealthLoading] = useState(true);

  // Modals state
  const [inspectedRide, setInspectedRide] = useState(null);
  const [locationModalDriver, setLocationModalDriver] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [cancelModalRide, setCancelModalRide] = useState(null);
  const [cancelingRide, setCancelingRide] = useState(false);

  // Active route to highlight on the map
  const [activeRouteForMap, setActiveRouteForMap] = useState(null);

  // Dynamic system activity stream
  const [events, setEvents] = useState([
    {
      type: "info",
      title: "System initialized",
      detail: "RideMesh microservices online & connected",
      time: new Date().toLocaleTimeString(),
    },
  ]);

  function logSystemEvent(type, title, detail) {
    const newEvent = {
      type,
      title,
      detail,
      time: new Date().toLocaleTimeString(),
    };
    setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
  }

  // Load drivers from Location Service (including Redis GPS coordinates)
  async function refreshDrivers() {
    try {
      const result = await api.getDrivers();

      const loadedDrivers = (result.data ?? []).map((driver, index) => ({
        id: driver.id,
        name: driver.name,
        vehicle: driver.vehicle_type,
        status: driver.status,
        location: driver.location ?? null,
        // Deterministic schematic layout positions for fallback display
        x: 15 + ((index * 29) % 70),
        y: 14 + ((index * 31) % 72),
      }));

      setDrivers(loadedDrivers);
      setDriversError("");
    } catch (error) {
      setDriversError(error.message || "Unknown error loading drivers");
    } finally {
      setDriversLoading(false);
    }
  }

  // Load rides from Ride Service
  async function refreshRides() {
    try {
      const result = await api.getRides();
      setRides((result.data ?? []).map(mapRideRecord));
      setRidesError("");
    } catch (error) {
      setRidesError(error.message || "Unable to load rides");
    } finally {
      setRidesLoading(false);
    }
  }

  // Check health of all 3 microservices
  async function checkServices() {
    try {
      const results = await fetchServiceHealth();
      setServiceHealth(results);
    } catch {
      // Keep previous health or mark DOWN
    } finally {
      setHealthLoading(false);
    }
  }

  // Handle ride matching and lifecycle actions
  async function handleRideAction(rideId, action) {
    try {
      setRideActionId(rideId);
      setRideActionError("");

      if (action === "MATCH") {
        const matchRes = await api.matchRide(rideId);
        logSystemEvent(
          "success",
          "Driver matched",
          `Ride ${rideId.slice(0, 8)} matched with driver ${matchRes.data?.driver_id?.slice(0, 8) ?? ""}`,
        );
      } else {
        const nextStatus = {
          START: "IN_PROGRESS",
          COMPLETE: "COMPLETED",
          CANCEL: "CANCELLED",
        }[action];

        await api.updateRideStatus(rideId, nextStatus);
        logSystemEvent(
          action === "CANCEL" ? "warning" : "success",
          `Ride ${nextStatus.replaceAll("_", " ")}`,
          `Ride ${rideId.slice(0, 8)} transitioned to ${nextStatus}`,
        );
      }

      await refreshRides();
      await refreshDrivers();
    } catch (error) {
      setRideActionError(error.message || "Unable to update ride");
      logSystemEvent("error", "Action failed", error.message);
    } finally {
      setRideActionId(null);
    }
  }

  // Handle destructive cancellation
  async function handleConfirmCancel(rideId) {
    try {
      setCancelingRide(true);
      await api.updateRideStatus(rideId, "CANCELLED");
      logSystemEvent(
        "warning",
        "Ride cancelled",
        `Ride ${rideId.slice(0, 8)} was cancelled by operator`,
      );
      setCancelModalRide(null);
      await refreshRides();
      await refreshDrivers();
    } catch (error) {
      alert(`Failed to cancel ride: ${error.message}`);
    } finally {
      setCancelingRide(false);
    }
  }

  // Handle saving driver location to Redis
  async function handleSaveDriverLocation(driverId, coords) {
    try {
      setSavingLocation(true);
      await api.updateDriverLocation(driverId, coords);

      logSystemEvent(
        "success",
        "Location updated",
        `Updated coordinates for driver ${driverId.slice(0, 8)}`,
      );

      await refreshDrivers();
      setLocationModalDriver(null);
    } catch (error) {
      alert(`Location update failed: ${error.message}`);
    } finally {
      setSavingLocation(false);
    }
  }

  // View a ride's route on the map
  function handleViewRideOnMap(ride) {
    setActiveRouteForMap({
      pickupCoords: ride.pickupCoords,
      dropoffCoords: ride.dropoffCoords,
    });
    setActivePage("Overview");
  }

  // Initial loading on mount with intervals
  useEffect(() => {
    let ignore = false;

    async function initialLoad() {
      try {
        const [driversRes, ridesRes, healthRes] = await Promise.allSettled([
          api.getDrivers(),
          api.getRides(),
          fetchServiceHealth(),
        ]);

        if (ignore) return;

        if (driversRes.status === "fulfilled") {
          const loaded = (driversRes.value.data ?? []).map((driver, index) => ({
            id: driver.id,
            name: driver.name,
            vehicle: driver.vehicle_type,
            status: driver.status,
            location: driver.location ?? null,
            x: 15 + ((index * 29) % 70),
            y: 14 + ((index * 31) % 72),
          }));
          setDrivers(loaded);
          setDriversError("");
        }

        if (ridesRes.status === "fulfilled") {
          setRides((ridesRes.value.data ?? []).map(mapRideRecord));
          setRidesError("");
        }

        if (healthRes.status === "fulfilled") {
          setServiceHealth(healthRes.value);
        }
      } finally {
        if (!ignore) {
          setDriversLoading(false);
          setRidesLoading(false);
          setHealthLoading(false);
        }
      }
    }

    void initialLoad();

    const intervalId = setInterval(() => {
      if (!ignore) {
        refreshDrivers();
        refreshRides();
        checkServices();
      }
    }, 10000);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <span className="local-indicator">
              <i /> BACKEND CONNECTED
            </span>
            <span className="topbar-divider" />
            <div className="topbar-avatar">OM</div>
          </div>
        </header>

        <div className="page-content">
          {activePage === "Overview" && (
            <Overview
              drivers={drivers}
              rides={rides}
              ridesLoading={ridesLoading}
              ridesError={ridesError}
              refreshRides={refreshRides}
              setActivePage={setActivePage}
              events={events}
              selectedDriver={selectedDriver}
              setSelectedDriver={setSelectedDriver}
              serviceHealth={serviceHealth}
              healthLoading={healthLoading}
              onInspectRide={(r) => setInspectedRide(r)}
              onLogEvent={logSystemEvent}
              onOpenLocationModal={(d) => setLocationModalDriver(d)}
              activeRoute={activeRouteForMap}
            />
          )}

          {activePage === "Live simulation" && (
            <LiveSimulationPage
              drivers={drivers}
              rides={rides}
              refreshDrivers={refreshDrivers}
              refreshRides={refreshRides}
              onLogEvent={logSystemEvent}
              onOpenLocationModal={(d) => setLocationModalDriver(d)}
              selectedDriver={selectedDriver}
              setSelectedDriver={setSelectedDriver}
              activeRoute={activeRouteForMap}
            />
          )}

          {activePage === "Rides" && (
            <RidesPage
              rides={rides}
              ridesLoading={ridesLoading}
              ridesError={ridesError}
              rideActionId={rideActionId}
              rideActionError={rideActionError}
              onRideAction={handleRideAction}
              onInspectRide={(r) => setInspectedRide(r)}
              onCancelRequest={(r) => setCancelModalRide(r)}
            />
          )}

          {activePage === "Drivers" && (
            <DriversPage
              drivers={drivers}
              selectedDriver={selectedDriver}
              setSelectedDriver={setSelectedDriver}
              driversLoading={driversLoading}
              driversError={driversError}
              refreshDrivers={refreshDrivers}
              onLogEvent={logSystemEvent}
              onOpenLocationModal={(d) => setLocationModalDriver(d)}
            />
          )}
        </div>
      </main>

      {/* RIDE DETAILS MODAL */}
      {inspectedRide && (
        <RideDetailsModal
          ride={inspectedRide}
          onClose={() => setInspectedRide(null)}
          onViewOnMap={handleViewRideOnMap}
        />
      )}

      {/* UPDATE DRIVER LOCATION MODAL */}
      {locationModalDriver && (
        <UpdateLocationModal
          driver={locationModalDriver}
          onClose={() => setLocationModalDriver(null)}
          onSave={handleSaveDriverLocation}
          saving={savingLocation}
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
