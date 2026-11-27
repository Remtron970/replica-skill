import type { SyncRecord } from "../../lib/store/collection";

export interface HealthDay extends SyncRecord {
  day: string; // YYYY-MM-DD
  steps: number | null;
  distanceKm: number | null;
  activeEnergyKcal: number | null;
  exerciseMinutes: number | null;
}

export interface WeightEntry extends SyncRecord {
  measuredAt: string; // ISO
  weightKg: number;
}
