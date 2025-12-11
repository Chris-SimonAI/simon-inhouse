export type AnalyticsEventProps = Record<string, unknown>;

export interface AnalyticsClient {
  init(): void;
  identify(userId: string, props?: AnalyticsEventProps): void;
  reset(): void;
  capture(event: string, props?: AnalyticsEventProps): void;
}

export interface AnalyticsServer {
  capture(
    distinctId: string,
    event: string,
    props?: AnalyticsEventProps
  ): Promise<void>;
}

