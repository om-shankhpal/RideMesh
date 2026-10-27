import { processPendingOutboxEvents } from "../services/outbox.service.js";

const DEFAULT_INTERVAL_MS = 5000;

export function startOutboxWorker({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  let isProcessing = false;

  async function runWorker() {
    if (isProcessing) {
      return;
    }

    isProcessing = true;

    try {
      const results = await processPendingOutboxEvents();

      if (results.processed > 0 || results.failed > 0) {
        console.log("Outbox worker results:", results);
      }
    } catch (error) {
      console.error("Outbox worker failed:", error.message);
    } finally {
      isProcessing = false;
    }
  }

  // Process pending events immediately when the worker starts.
  void runWorker();

  // Continue polling at the configured interval.
  const timer = setInterval(() => {
    void runWorker();
  }, intervalMs);

  return function stopOutboxWorker() {
    clearInterval(timer);
  };
}
