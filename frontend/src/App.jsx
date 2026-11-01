import { useEffect, useState } from "react";

import "./App.css";

import { fetchServiceHealth } from "./api/health.js";

import { api } from "./api/client.js";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
    rider: ride.rider_id
      ? `Rider · ${ride.rider_id.slice(0, 8)}`
      : "Unknown rider",
    pickup: formatCoordinate(ride.pickup_latitude, ride.pickup_longitude),
    dropoff: formatCoordinate(ride.dropoff_latitude, ride.dropoff_longitude),
    status: ride.status,
    driver: ride.driver_id ? ride.driver_id.slice(0, 8) : null,
    time: formatRideTime(ride.created_at),
  };
}

const initialEvents = [
  {
    type: "success",

    title: "Driver assigned",

    detail: "DRV-112 assigned to RM-2081",

    time: "14:32:08",
  },

  {
    type: "info",

    title: "Ride requested",

    detail: "New request RM-2082 received",

    time: "14:31:42",
  },

  {
    type: "success",

    title: "Driver discovered",

    detail: "3 nearby candidates returned",

    time: "14:30:17",
  },

  {
    type: "warning",

    title: "Driver status update",

    detail: "DRV-121 changed to ON_TRIP",

    time: "14:28:53",
  },
];

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

    CANCELLED: "red",
  };

  return (
    <span className={`status-badge ${styles[status] || "muted"}`}>
      <span className="status-dot" />

      {status.replaceAll("_", " ")}
    </span>
  );
}

function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#overview"
        onClick={() => setActivePage("Overview")}
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
            className={`nav-item ${activePage === item.label ? "active" : ""}`}
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

      <div className="sidebar-bottom">
        <div className="environment-card">
          <div className="environment-heading">
            <span className="environment-dot" />
            Simulation mode
          </div>

          <p>Visual preview</p>

          <span>Backend integration in progress</span>
        </div>

        <div className="profile">
          <div className="avatar">RM</div>

          <div className="profile-copy">
            <strong>RideMesh Admin</strong>

            <span>Local workspace</span>
          </div>

          <span className="profile-menu">···</span>
        </div>
      </div>
    </aside>
  );
}

const pickupPosition = [19.0602, 72.8365];
const destinationPosition = [19.0475, 72.8742];

const pickupIcon = L.divIcon({
  className: "custom-map-icon",
  html: '<div class="map-pin-icon pickup-marker">P</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: "custom-map-icon",
  html: '<div class="map-pin-icon destination-marker">D</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const driverIcon = (busy, selected) =>
  L.divIcon({
    className: "custom-map-icon",
    html: `<div class="car-marker ${busy ? "busy" : ""} ${
      selected ? "selected" : ""
    }">⌁</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

function driverPosition(driver) {
  // These are simulated positions, not actual driver GPS coordinates.
  const x = Number(driver.x ?? 50);
  const y = Number(driver.y ?? 50);

  return [19.035 + (y / 100) * 0.045, 72.815 + (x / 100) * 0.075];
}

function CityMap({ drivers, selectedDriver, setSelectedDriver }) {
  const selected = drivers.find((driver) => driver.id === selectedDriver);

  return (
    <div className="map-canvas">
      <MapContainer
        center={[19.055, 72.85]}
        zoom={13}
        scrollWheelZoom
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Polyline
          positions={[pickupPosition, destinationPosition]}
          pathOptions={{
            color: "#26b96b",
            weight: 5,
            opacity: 0.85,
            dashArray: "10 9",
          }}
        />

        <Marker position={pickupPosition} icon={pickupIcon}>
          <Popup>Illustrative pickup location</Popup>
        </Marker>

        <Marker position={destinationPosition} icon={destinationIcon}>
          <Popup>Illustrative destination</Popup>
        </Marker>

        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            position={driverPosition(driver)}
            icon={driverIcon(
              driver.status === "ON_TRIP",
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
              {driver.vehicle}
              <br />
              {driver.status.replaceAll("_", " ")}
              <br />
              <small>Simulated map position</small>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="map-floating-card">
        <div className="map-card-heading">
          <span className="map-card-pulse" />
          DRIVER NETWORK
        </div>

        <strong>{drivers.length} drivers</strong>
        <span>
          {drivers.filter((driver) => driver.status === "AVAILABLE").length}{" "}
          available nearby
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
              <span>{selected.id}</span>
            </div>
          </div>

          <StatusBadge status={selected.status} />
          <p>{selected.vehicle}</p>
          <small>Illustrative position · Not GPS data</small>
        </div>
      )}

      <div className="map-disclaimer">
        Illustrative driver positions · Not live GPS
      </div>
    </div>
  );
}

function Overview({
  drivers,

  rides,
  ridesLoading,
  ridesError,
  setActivePage,

  events,

  setSelectedDriver,

  selectedDriver,

  serviceHealth,

  healthLoading,
}) {
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
            className="button-primary"
            onClick={() =>
              alert(
                "Ride creation will be connected to Ride Service in the next milestone.",
              )
            }
          >
            <span>＋</span> Create ride
          </button>
        </div>
      </section>

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
            <span className="metric-dot green-bg" /> Ready to receive requests
          </div>

          <div className="metric-sparkline green-line">
            <span />

            <span />

            <span />

            <span />

            <span />

            <span />

            <span />
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
            <span />

            <span />

            <span />

            <span />

            <span />

            <span />

            <span />
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
            <span className="metric-dot amber-bg" /> Waiting for a driver
          </div>

          <div className="metric-sparkline amber-line">
            <span />

            <span />

            <span />

            <span />

            <span />

            <span />

            <span />
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
              ? "Checking backend connectivity"
              : serviceHealth.length > 0 &&
                  healthyCount === serviceHealth.length
                ? "All backend services operational"
                : "One or more services are unavailable"}
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

      <section className="main-grid">
        <article className="panel map-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Driver distribution</div>

              <div className="panel-subtitle">
                Mumbai · Schematic simulation map
              </div>
            </div>

            <button
              className="subtle-button"
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
            />
          </div>

          <div className="map-footer">
            <span>
              <i className="footer-dot green-bg" /> {availableCount} available
            </span>

            <span>
              <i className="footer-dot purple-bg" />{" "}
              {drivers.filter((driver) => driver.status === "ON_TRIP").length}{" "}
              on trip
            </span>

            <span className="map-footer-note">
              Illustrative locations · Not GPS data
            </span>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Activity stream</div>

              <div className="panel-subtitle">Example system events</div>
            </div>

            <span className="activity-live">
              <i /> PREVIEW
            </span>
          </div>

          <div className="event-list">
            {events.map((event, index) => (
              <div className="event-item" key={`${event.time}-${index}`}>
                <div className={`event-icon ${event.type}`}>
                  {event.type === "success"
                    ? "✓"
                    : event.type === "warning"
                      ? "!"
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
            Events will come from backend actions after integration.
          </div>
        </article>
      </section>

      <section className="panel rides-panel">
        <div className="panel-header rides-heading">
          <div>
            <div className="panel-title">Recent ride requests</div>

            <div className="panel-subtitle">
              Inspect the simulated ride lifecycle
            </div>
          </div>

          <button
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
                  <td colSpan={6}>Loading rides...</td>
                </tr>
              )}
              {ridesError && (
                <tr>
                  <td colSpan={6}>Unable to load rides: {ridesError}</td>
                </tr>
              )}
              {!ridesLoading && !ridesError && rides.length === 0 && (
                <tr>
                  <td colSpan={6}>No rides found.</td>
                </tr>
              )}
              {rides.map((ride) => (
                <tr key={ride.id}>
                  <td>
                    <span className="ride-id">{ride.id}</span>

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
                      className="row-action"
                      title="Ride details"
                      onClick={() =>
                        alert(
                          `Ride ID: ${ride.id}\nRider ID: ${ride.rider}\nDriver ID: ${ride.driver || "Unassigned"}\nPickup: ${ride.pickup}\nDrop-off: ${ride.dropoff}\nStatus: ${ride.status}`,
                        )
                      }
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

      <footer className="page-footer">
        <span>
          RIDEMESH <span className="footer-separator">/</span> SIMULATION
          WORKSPACE
        </span>

        <span>Built to demonstrate distributed ride matching</span>
      </footer>
    </>
  );
}

function DriversPage({
  drivers,
  selectedDriver,
  setSelectedDriver,
  driversLoading,
  driversError,
  refreshDrivers,
}) {
  const [formMode, setFormMode] = useState(null);
  const [editingDriverId, setEditingDriverId] = useState(null);

  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("BIKE");

  const [saving, setSaving] = useState(false);
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

      const driverData = {
        name: trimmedName,
        vehicleType,
      };

      if (formMode === "add") {
        await api.createDriver(driverData);
        setSuccessMessage("Driver created successfully.");
      } else {
        await api.updateDriver(editingDriverId, driverData);
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

  return (
    <section className="page-section">
      <div className="section-intro">
        <div className="eyebrow">FLEET MANAGEMENT</div>

        <h1>Driver directory</h1>

        <p>
          Manage driver records from the Location Service database. Map
          positions remain illustrative because this list does not contain GPS
          coordinates.
        </p>

        <button
          type="button"
          className="button-primary"
          onClick={openAddForm}
          disabled={saving}
        >
          + Add driver
        </button>
      </div>

      {successMessage && <p role="status">{successMessage}</p>}

      {driversLoading && (
        <p role="status">Loading drivers from Location Service...</p>
      )}

      {driversError && (
        <p role="alert">Unable to load drivers: {driversError}</p>
      )}

      {formMode && (
        <div
          className="panel"
          style={{ padding: "24px", marginBottom: "24px" }}
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

            {formError && <p role="alert">{formError}</p>}

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

              <button type="button" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!driversLoading && !driversError && drivers.length === 0 && (
        <p>No drivers found in the database.</p>
      )}

      <div className="driver-grid">
        {drivers.map((driver) => (
          <article
            key={driver.id}
            className={`driver-card ${
              selectedDriver === driver.id ? "driver-card-selected" : ""
            }`}
          >
            <button
              type="button"
              className="driver-card-select"
              onClick={() =>
                setSelectedDriver(
                  selectedDriver === driver.id ? null : driver.id,
                )
              }
            >
              <div className="driver-card-top">
                <div className="avatar driver-avatar">DR</div>
                <StatusBadge status={driver.status} />
              </div>

              <strong>{driver.name}</strong>

              <span className="driver-id">{driver.id}</span>

              <span className="driver-vehicle">{driver.vehicle}</span>

              <span className="driver-card-link">
                Inspect on map <span>↗</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => openEditForm(driver)}
              disabled={saving}
            >
              Edit details
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function RidesPage({
  rides,
  ridesLoading,
  ridesError,
  rideActionId,
  rideActionError,
  onRideAction,
}) {
  function getActions(status) {
    switch (status) {
      case "REQUESTED":
        return [
          { label: "Match driver", action: "MATCH" },
          { label: "Cancel", action: "CANCEL" },
        ];

      case "MATCHED":
        return [
          { label: "Start ride", action: "START" },
          { label: "Cancel", action: "CANCEL" },
        ];

      case "IN_PROGRESS":
        return [{ label: "Complete ride", action: "COMPLETE" }];

      default:
        return [];
    }
  }

  return (
    <section className="page-section">
      <div className="section-intro">
        <div className="eyebrow">RIDE LIFECYCLE</div>

        <h1>Ride requests</h1>

        <p>
          Ride records loaded from the Ride Service database. Coordinates are
          shown directly because the API does not provide named locations.
        </p>
      </div>

      {ridesLoading && <p role="status">Loading rides from Ride Service...</p>}

      {ridesError && <p role="alert">Unable to load rides: {ridesError}</p>}

      {rideActionError && (
        <p role="alert">Ride action failed: {rideActionError}</p>
      )}

      {!ridesLoading && !ridesError && rides.length === 0 && (
        <p>No rides found in the database.</p>
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
              </tr>
            </thead>

            <tbody>
              {rides.map((ride) => {
                const actions = getActions(ride.status);
                const isProcessing = rideActionId === ride.id;

                return (
                  <tr key={ride.id}>
                    <td>
                      <span className="ride-id">{ride.id}</span>
                      <small>{ride.rider}</small>
                    </td>

                    <td>
                      {ride.pickup} → {ride.dropoff}
                    </td>

                    <td>{ride.driver || "Unassigned"}</td>

                    <td>
                      <StatusBadge status={ride.status} />
                    </td>

                    <td className="time-cell">{ride.time}</td>

                    <td>
                      <div className="ride-actions">
                        {actions.length === 0 ? (
                          <span>—</span>
                        ) : (
                          actions.map(({ label, action }) => (
                            <button
                              key={action}
                              type="button"
                              disabled={rideActionId !== null}
                              onClick={() => onRideAction(ride.id, action)}
                            >
                              {isProcessing ? "Processing..." : label}
                            </button>
                          ))
                        )}
                      </div>
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

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [selectedDriver, setSelectedDriver] = useState(null);

  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState("");

  const [rides, setRides] = useState([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [ridesError, setRidesError] = useState("");

  const [events] = useState(initialEvents);

  const [serviceHealth, setServiceHealth] = useState([]);
  const [healthLoading, setHealthLoading] = useState(true);

  const [rideActionId, setRideActionId] = useState(null);
  const [rideActionError, setRideActionError] = useState("");

  // Fetch drivers and convert database records into frontend format.
  async function refreshDrivers() {
    try {
      setDriversLoading(true);

      const result = await api.getDrivers();

      const loadedDrivers = (result.data ?? []).map((driver, index) => ({
        id: driver.id,
        name: driver.name,
        vehicle: driver.vehicle_type,
        status: driver.status,

        // Simulated map positions, not actual GPS coordinates.
        x: 12 + ((index * 23) % 76),
        y: 14 + ((index * 31) % 72),
      }));

      setDrivers(loadedDrivers);
      setDriversError("");
    } catch (error) {
      setDriversError(error.message || "Unknown error");
    } finally {
      setDriversLoading(false);
    }
  }

  // Handle ride matching and lifecycle actions.
  async function handleRideAction(rideId, action) {
    try {
      setRideActionId(rideId);
      setRideActionError("");

      if (action === "MATCH") {
        await api.matchRide(rideId);
      } else {
        const nextStatus = {
          START: "IN_PROGRESS",
          COMPLETE: "COMPLETED",
          CANCEL: "CANCELLED",
        }[action];

        await api.updateRideStatus(rideId, nextStatus);
      }

      // Refresh rides after a successful action.
      const result = await api.getRides();

      setRides((result.data ?? []).map(mapRideRecord));
      setRidesError("");

      // Refresh driver statuses as matching can change driver availability.
      await refreshDrivers();
    } catch (error) {
      setRideActionError(error.message || "Unable to update ride");
    } finally {
      setRideActionId(null);
    }
  }

  // Initial driver loading and automatic refresh.
  useEffect(() => {
    refreshDrivers();

    const intervalId = setInterval(refreshDrivers, 15000);

    return () => clearInterval(intervalId);
  }, []);

  // Initial ride loading and automatic refresh.
  useEffect(() => {
    let active = true;

    async function loadRides() {
      try {
        const result = await api.getRides();
        const loadedRides = (result.data ?? []).map(mapRideRecord);

        if (active) {
          setRides(loadedRides);
          setRidesError("");
        }
      } catch (error) {
        if (active) {
          setRidesError(error.message || "Unknown error");
        }
      } finally {
        if (active) {
          setRidesLoading(false);
        }
      }
    }

    loadRides();

    const intervalId = setInterval(loadRides, 15000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  // Backend service health monitoring.
  useEffect(() => {
    let active = true;

    async function checkServices() {
      try {
        const results = await fetchServiceHealth();

        if (active) {
          setServiceHealth(results);
          setHealthLoading(false);
        }
      } catch (error) {
        if (active) {
          setHealthLoading(false);
        }
      }
    }

    checkServices();

    const intervalId = setInterval(checkServices, 15000);

    return () => {
      active = false;
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
              setActivePage={setActivePage}
              events={events}
              selectedDriver={selectedDriver}
              setSelectedDriver={setSelectedDriver}
              serviceHealth={serviceHealth}
              healthLoading={healthLoading}
            />
          )}

          {activePage === "Live simulation" && (
            <section className="page-section">
              <div className="section-intro">
                <div className="eyebrow">LIVE SIMULATION</div>

                <h1>City operations</h1>

                <p>
                  Select a driver marker to inspect its illustrative status and
                  vehicle.
                </p>
              </div>

              <div className="panel map-panel standalone-map">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">Mumbai driver map</div>

                    <div className="panel-subtitle">
                      Schematic layout · Not geographic coordinates
                    </div>
                  </div>
                </div>

                <div className="map-wrapper">
                  <CityMap
                    drivers={drivers}
                    selectedDriver={selectedDriver}
                    setSelectedDriver={setSelectedDriver}
                  />
                </div>
              </div>
            </section>
          )}

          {activePage === "Rides" && (
            <RidesPage
              rides={rides}
              ridesLoading={ridesLoading}
              ridesError={ridesError}
              rideActionId={rideActionId}
              rideActionError={rideActionError}
              onRideAction={handleRideAction}
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
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
