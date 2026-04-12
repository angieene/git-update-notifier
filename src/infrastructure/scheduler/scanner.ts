import type { ScanService, ScanLogger } from '../../application/scan-service';

export function startScanner(
  svc: ScanService,
  intervalMs: number,
  logger: ScanLogger,
): () => void {
  const controller = new AbortController();
  let running = false;

  const runOnce = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await svc.tick(controller.signal);
    } catch (err) {
      logger.error({ err }, 'scan tick crashed');
    } finally {
      running = false;
    }
  };

  const handle = setInterval(() => void runOnce(), intervalMs);
  // Initial run after 10s so startup is not blocked
  const initial = setTimeout(() => void runOnce(), 10_000);

  return (): void => {
    controller.abort();
    clearInterval(handle);
    clearTimeout(initial);
  };
}
