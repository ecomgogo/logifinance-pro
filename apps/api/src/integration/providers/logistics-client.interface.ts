export interface NormalizedTrackingEvent {
  occurredAt: string;
  location: string;
  description: string;
}

export interface NormalizedTrackingResult {
  providerCode: string;
  trackingNumber: string;
  status: string;
  statusName: string;
  events: NormalizedTrackingEvent[];
}

export interface LogisticsClient {
  readonly providerCode: string;
  getTracking(trackingNumber: string): Promise<NormalizedTrackingResult>;
}
