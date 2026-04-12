import type { ScanLogger, ScanService } from '../../application/scan-service';

export interface StartScannerOptions {
  intervalMs: number;
  initialDelayMs?: number;
}

export function startScanner(
  svc: ScanService,
  options: StartScannerOptions,
  logger: ScanLogger,
): () => Promise<void> {
  const controller = new AbortController();
  let running = false;
  let currentTick: Promise<void> | null = null;

  const runOnce = async (): Promise<void> => {
    if (running) {
      logger.warn('previous tick still running, skipping');
      return;
    }
    running = true;
    const start = Date.now();
    try {
      currentTick = svc.tick(controller.signal);
      await currentTick;
      logger.info(`scan tick complete in ${Date.now() - start}ms`);
    } catch (err) {
      logger.error({ err }, 'scan tick crashed');
    } finally {
      running = false;
      currentTick = null;
    }
  };

  const intervalHandle = setInterval(() => void runOnce(), options.intervalMs);
  const initialHandle = setTimeout(() => void runOnce(), options.initialDelayMs ?? 10_000);

  return async (): Promise<void> => {
    controller.abort();
    clearInterval(intervalHandle);
    clearTimeout(initialHandle);
    if (currentTick) {
      try { await currentTick; } catch { /* swallowed — logged by runOnce */ }
    }
  };
}
