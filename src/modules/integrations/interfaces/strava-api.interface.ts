export interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  athlete?: {
    id: number;
    username?: string;
    firstname?: string;
    lastname?: string;
    profile?: string;
  };
}

export interface StravaActivitySummary {
  id: number;
  external_id?: string;
  upload_id?: number;
  athlete: { id: number };
  name: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain?: number; // meters
  type: string; // Run, TrailRun, VirtualRun, Ride, etc.
  sport_type?: string;
  start_date: string; // ISO date string
  start_date_local: string;
  timezone?: string;
  average_speed?: number; // m/s
  max_speed?: number; // m/s
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kilojoules?: number;
  calories?: number;
  device_name?: string;
  private?: boolean;
  visibility?: string;
}

export interface StravaWebhookPayload {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
}
