export interface GCalSyncStatus {
  connected: boolean;
  calendar_id?: string;
  last_sync?: string;
  channel_active: boolean;
  channel_expiry?: string;
}

export interface GCalAuthUrl {
  url: string;
  state: string;
}

export interface GCalSyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: number;
}
