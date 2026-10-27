import { pool } from "../config/database.js";

export async function findPendingOutboxEvents(limit = 50) {
  const query = `
    SELECT
      id,
      event_type,
      aggregate_id,
      payload,
      retry_count,
      created_at
    FROM outbox_events
    WHERE status = 'PENDING'
    ORDER BY created_at ASC
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);

  return result.rows;
}

export async function markOutboxEventProcessed(eventId) {
  const query = `
    UPDATE outbox_events
    SET
      status = 'PROCESSED',
      processed_at = NOW()
    WHERE id = $1
      AND status = 'PENDING'
    RETURNING id
  `;

  const result = await pool.query(query, [eventId]);

  return result.rows[0] ?? null;
}

export async function incrementOutboxRetryCount(eventId) {
  const query = `
    UPDATE outbox_events
    SET retry_count = retry_count + 1
    WHERE id = $1
      AND status = 'PENDING'
    RETURNING retry_count
  `;

  const result = await pool.query(query, [eventId]);

  return result.rows[0] ?? null;
}

export async function markOutboxEventFailed(eventId) {
  const query = `
    UPDATE outbox_events
    SET status = 'FAILED'
    WHERE id = $1
      AND status = 'PENDING'
    RETURNING id
  `;

  const result = await pool.query(query, [eventId]);

  return result.rows[0] ?? null;
}
    