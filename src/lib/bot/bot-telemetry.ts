export type BotRunType =
  | "menu-scrape"
  | "toast-order"
  | "status-check"
  | "scraper-test"
  | "scraper-calibrate";

export interface BotRunTelemetry {
  runType: BotRunType;
  success: boolean;
  stage: string;
  cfDetected: boolean;
  proxyUsed: boolean;
  unlockerUsed: boolean;
  durationMs: number;
  failReason?: string;
  metadata?: Record<string, unknown>;
}

export function logBotRunTelemetry(event: BotRunTelemetry): void {
  const payload = {
    timestamp: new Date().toISOString(),
    run_type: event.runType,
    success: event.success,
    stage: event.stage,
    cf_detected: event.cfDetected,
    proxy_used: event.proxyUsed,
    unlocker_used: event.unlockerUsed,
    duration_ms: event.durationMs,
    fail_reason: event.failReason,
    metadata: event.metadata,
  };

  console.log(`[bot-telemetry] ${JSON.stringify(payload)}`);
}
