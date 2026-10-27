import {
  findPendingOutboxEvents,
  markOutboxEventProcessed,
  incrementOutboxRetryCount,
  markOutboxEventFailed,
} from "../repositories/outbox.repository.js";

const LOCATION_SERVICE_URL =
  process.env.LOCATION_SERVICE_URL || "http://localhost:3001";

const MAX_ATTEMPTS = 5;

async function recordProcessingFailure(event) {
  try {
    const updatedEvent = await incrementOutboxRetryCount(event.id);

    if (!updatedEvent) {
      return;
    }

    const totalAttempts = updatedEvent.retry_count;

    if (totalAttempts >= MAX_ATTEMPTS) {
      await markOutboxEventFailed(event.id);

      console.error(
        `Outbox event ${event.id} marked FAILED after ${totalAttempts} failed attempts.`,
      );
    }
  } catch (error) {
    console.error(
      `Could not record retry for outbox event ${event.id}:`,
      error.message,
    );
  }
}

export async function processPendingOutboxEvents() {
  const events = await findPendingOutboxEvents();

  const results = {
    processed: 0,
    failed: 0,
  };

  for (const event of events) {
    try {
      if (event.event_type !== "DRIVER_STATUS_UPDATE") {
        throw new Error(`Unsupported event type: ${event.event_type}`);
      }

      const { driverId, status } = event.payload;

      const response = await fetch(
        `${LOCATION_SERVICE_URL}/drivers/${driverId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        throw new Error(`Location Service returned HTTP ${response.status}`);
      }

      await markOutboxEventProcessed(event.id);
      results.processed++;
    } catch (error) {
      console.error(
        `Failed to process outbox event ${event.id}:`,
        error.message,
      );

      results.failed++;

      await recordProcessingFailure(event);
    }
  }

  return results;
}
