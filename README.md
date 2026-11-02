# RideMesh — Distributed Real-Time Ride Matching & Dispatch Platform

RideMesh is a high-concurrency ride-matching and dispatch **simulation platform** built with a microservices architecture. It models core ride-hailing operations: geospatial driver discovery, concurrent ride dispatch, lifecycle management, and asynchronous driver-state synchronization.

The project focuses on backend engineering problems rather than user registration or payments: **preventing double assignment, maintaining state consistency across services, and finding nearby available drivers efficiently.**

> **Local demo:** RideMesh is designed to run locally. It is not currently deployed. The screenshots below show the working operations dashboard and its main workflows.

## Dashboard Preview

### Overview
![RideMesh overview dashboard](/screenshots/overview.png)

### Live simulation
![RideMesh live simulation dashboard](/screenshots/live-simulation.png)

### Rides
![RideMesh rides management page](/screenshots/rides.png)

### Drivers
![RideMesh driver management page](/screenshots/drivers.png)

## Architecture

RideMesh consists of three backend microservices, a React operations dashboard, PostgreSQL, and Redis.

```mermaid
flowchart TD
    subgraph Client["Frontend Operations Console"]
        UI["React 19 Dashboard<br/>(React Leaflet, Vite :5173)"]
    end
    subgraph Gateway["Vite Reverse Proxy (/api/*)"]
        Proxy["Vite Proxy Layer"]
    end
    subgraph Services["Backend Microservices"]
        LS["Location Service :3001<br/>Express 5, Zod"]
        RS["Ride Service :3002<br/>Express 5, Zod, Outbox Worker"]
        MS["Match Service :3003<br/>Express 5, Zod"]
    end
    subgraph Stores["Data & State Stores"]
        LDB[("PostgreSQL: location_db<br/>drivers")]
        RDB[("PostgreSQL: ride_db<br/>rides, outbox_events")]
        Redis[("Redis 7<br/>drivers:geo")]
    end
    UI --> Proxy
    Proxy -->|/api/location| LS
    Proxy -->|/api/rides| RS
    Proxy -->|/api/matches| MS
    MS -->|Nearby driver lookup| LS
    MS -->|Driver assignment| RS
    LS --> LDB
    LS -->|GEOADD / GEOSEARCH| Redis
    RS -->|Transactions + outbox| RDB
    RS -.->|Async driver status updates| LS
```

### Service responsibilities

| Service | Port | Responsibility |
|---|---:|---|
| Location Service | 3001 | Driver records, operational status, GPS coordinates, and nearby-driver search |
| Ride Service | 3002 | Ride creation, lifecycle transitions, transactional assignment, and outbox event processing |
| Match Service | 3003 | Dispatch orchestration: find nearby available drivers and attempt assignment |
| Frontend | 5173 | Operations dashboard, map, ride/driver management, and simulation controls |

## Key engineering concepts

### 1. Concurrency-safe driver assignment

Ride assignment is protected at multiple levels:

- PostgreSQL transaction and `SELECT ... FOR UPDATE` row locking.
- A partial unique index prevents one driver from being assigned to multiple active rides.

```sql
CREATE UNIQUE INDEX idx_rides_unique_active_driver
ON rides (driver_id)
WHERE driver_id IS NOT NULL
  AND status IN ('MATCHED', 'IN_PROGRESS');
```

- Conflicting concurrent assignments are rejected rather than silently double-booked.

### 2. Transactional outbox pattern

Ride state changes and corresponding outbox events are written in the same database transaction. A background worker polls pending events and calls the Location Service to synchronize driver status.

This supports eventual consistency between the Ride Service database and the driver's operational state, with retry tracking for failed delivery.

### 3. Redis geospatial driver discovery

The Location Service stores driver coordinates in the Redis geospatial index `drivers:geo`. Nearby-driver queries use Redis geospatial search and then verify availability against PostgreSQL so stale geo entries do not make unavailable drivers eligible for dispatch.

### 4. Ride lifecycle

The supported ride states are:

`REQUESTED → MATCHED → IN_PROGRESS → COMPLETED`

A ride may also transition to `CANCELLED` where allowed by the service's lifecycle rules. Completing or cancelling an assigned ride emits an outbox event to release the driver.

## Technology stack

| Area | Technologies |
|---|---|
| Runtime | Node.js (ES Modules) |
| Backend | Express 5 |
| Validation | Zod |
| Database | PostgreSQL 16 |
| Geospatial/cache | Redis 7 |
| Frontend | React 19, Vite 8 |
| Map | React Leaflet, Leaflet, OpenStreetMap tiles |
| Testing | Vitest, Supertest |
| Infrastructure | Docker, Docker Compose |

## Repository structure

```text
ride-matching-system/
├── docker/
│   └── init-db.sql
├── docker-compose.yml
├── frontend/
│   └── src/
│       ├── api/
│       ├── App.jsx
│       ├── App.css
│       └── constants.js
├── location-service/
│   └── src/
│       ├── config/
│       ├── repositories/
│       ├── routes/
│       ├── validation/
│       └── server.js
├── match-service/
│   └── src/
│       ├── clients/
│       ├── routes/
│       ├── services/
│       └── server.js
├── ride-service/
│   └── src/
│       ├── config/
│       ├── repositories/
│       ├── routes/
│       ├── services/
│       ├── workers/
│       └── server.js
└── docs/
    └── screenshots/
        ├── overview.png
        ├── live-simulation.png
        ├── rides.png
        └── drivers.png
```

## API overview

All services expose a `/health` endpoint.

### Location Service — `:3001`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/drivers` | List drivers |
| POST | `/drivers` | Create a driver |
| GET | `/drivers/:id` | Get driver details |
| PATCH | `/drivers/:id` | Edit driver name or vehicle type |
| PATCH | `/drivers/:id/status` | Update driver status |
| GET | `/drivers/:id/location` | Get driver's GPS coordinates |
| PATCH | `/drivers/:id/location` | Update driver's GPS coordinates |
| GET | `/drivers/nearby` | Find nearby available drivers |

### Ride Service — `:3002`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/rides` | List rides |
| POST | `/rides` | Create a ride |
| GET | `/rides/:id` | Get ride details |
| PATCH | `/rides/:id/assign` | Assign a driver |
| PATCH | `/rides/:id/status` | Advance or cancel a ride |

### Match Service — `:3003`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/matches/:rideId` | Find and assign a nearby available driver |

## Run locally

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker and Docker Compose (for containerized infrastructure)

### 1. Configure environment variables

Create the service `.env` files using the corresponding `.env.example` files.

Example `location-service/.env`:

```ini
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/location_db
REDIS_URL=redis://localhost:6379
```

Example `ride-service/.env`:

```ini
PORT=3002
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ride_db
REDIS_URL=redis://localhost:6379
LOCATION_SERVICE_URL=http://localhost:3001
```

Example `match-service/.env`:

```ini
PORT=3003
NODE_ENV=development
LOCATION_SERVICE_URL=http://localhost:3001
RIDE_SERVICE_URL=http://localhost:3002
```

Use your own local credentials; do not commit `.env` files.

### 2. Start infrastructure

If using Docker Compose:

```bash
docker compose up -d
```

If running PostgreSQL and Redis separately, ensure both are available before starting the services.

### 3. Initialize the databases

Ensure the databases `location_db` and `ride_db` exist, then apply the relevant statements from `docker/init-db.sql` to their respective databases. The file also contains setup for `ride_test_db` for automated tests.

### 4. Install dependencies

From the repository root:

```bash
npm install
```

If the root workspace does not install all packages, install each package using its own `npm install` command.

### 5. Start the services

Run each command in a separate terminal:

```bash
npm --prefix location-service start
npm --prefix ride-service start
npm --prefix match-service start
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Tests

Run the test suites from the repository root:

```bash
npm test
```

Individual suites:

```bash
npm run test:location
npm run test:ride
npm run test:match
```

Frontend checks:

```bash
npm run lint
npm run build
```

The project's documented test baseline is **64 passing tests** across the three backend services (25 Location, 23 Ride, and 16 Match). Re-run the tests in your current checkout before relying on these counts.

## Demonstration workflow

1. Open **Drivers** and add drivers with a vehicle type.
2. Set a driver to **AVAILABLE** and assign GPS coordinates using one of the Mumbai presets.
3. Open **Create Ride**, select a simulated rider, and choose a preset route.
4. In **Rides**, match the requested ride. The Match Service searches for nearby available drivers.
5. Start the matched trip, then complete or cancel it.
6. Observe the outbox worker synchronize the driver's status back to **AVAILABLE**.
7. In **Live simulation**, run the concurrent dispatch test to demonstrate that two rides competing for one driver cannot both claim that driver.

## Known scope and limitations

- This is a **simulation platform**, not a production ride-hailing service.
- Rider identities are simulated; there is no public rider registration or authentication flow.
- The geographic demo data is tailored to Mumbai, India.
- The project is intended to be demonstrated locally; no public deployment is currently provided.

## Future improvements

- Add authentication and role-based access for operations users.
- Add observability with structured logs, metrics, and distributed tracing.
- Add automated end-to-end tests covering the complete frontend-to-service workflow.
- Add production deployment configuration and managed infrastructure when hosting resources are available.

## Author

**Om Shankhpal**  
Java Backend Engineer · MERN Stack Developer

- GitHub: [om-shankhpal](https://github.com/om-shankhpal)
- LinkedIn: [Om Shankhpal](https://www.linkedin.com/in/om-shankhpal-089822320/)
