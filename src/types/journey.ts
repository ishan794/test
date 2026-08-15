export type JourneyStatus = 'active' | 'completed' | 'auto-sos-triggered';

export interface Journey {
  id: string;
  userId: string;
  status: JourneyStatus;
  destinationName: string;
  destinationLocation: { lat: number; lng: number };
  startLocation: { lat: number; lng: number };
  startedAt: any;
  etaMinutes: number;
  autoSosAt: any;
  sharedWithContactIds: string[];
}
