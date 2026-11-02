-- Create databases
CREATE DATABASE location_db;
CREATE DATABASE ride_db;
CREATE DATABASE ride_test_db;

-- Connect to location_db
\c location_db;

CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('BIKE', 'CAR')),
    status VARCHAR(50) NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('AVAILABLE', 'ON_TRIP', 'OFFLINE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers (status);

-- Connect to ride_db
\c ride_db;

CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL,
    driver_id UUID,
    pickup_latitude DOUBLE PRECISION NOT NULL CHECK (pickup_latitude >= -90 AND pickup_latitude <= 90),
    pickup_longitude DOUBLE PRECISION NOT NULL CHECK (pickup_longitude >= -180 AND pickup_longitude <= 180),
    dropoff_latitude DOUBLE PRECISION NOT NULL CHECK (dropoff_latitude >= -90 AND dropoff_latitude <= 90),
    dropoff_longitude DOUBLE PRECISION NOT NULL CHECK (dropoff_longitude >= -180 AND dropoff_longitude <= 180),
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides (rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_unique_active_driver ON rides (driver_id)
    WHERE driver_id IS NOT NULL AND status IN ('MATCHED', 'IN_PROGRESS');

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_pending ON outbox_events (created_at)
    WHERE status = 'PENDING';

-- Connect to ride_test_db
\c ride_test_db;

CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL,
    driver_id UUID,
    pickup_latitude DOUBLE PRECISION NOT NULL CHECK (pickup_latitude >= -90 AND pickup_latitude <= 90),
    pickup_longitude DOUBLE PRECISION NOT NULL CHECK (pickup_longitude >= -180 AND pickup_longitude <= 180),
    dropoff_latitude DOUBLE PRECISION NOT NULL CHECK (dropoff_latitude >= -90 AND dropoff_latitude <= 90),
    dropoff_longitude DOUBLE PRECISION NOT NULL CHECK (dropoff_longitude >= -180 AND dropoff_longitude <= 180),
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides (rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_unique_active_driver ON rides (driver_id)
    WHERE driver_id IS NOT NULL AND status IN ('MATCHED', 'IN_PROGRESS');

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_pending ON outbox_events (created_at)
    WHERE status = 'PENDING';

