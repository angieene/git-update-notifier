export interface TrackedRepo {
  id: number;
  owner: string;
  name: string;
  lastSeenTag: string | null;
  lastCheckedAt: Date | null;
}
