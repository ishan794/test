export type IncidentType = 'harassment' | 'stalking' | 'ragging' | 'unsafe-area' | 'hazard' | 'other';
export type IncidentStatus = 'submitted' | 'under-review' | 'resolved' | 'rejected';

export interface Incident {
  id: string;
  reporterId: string | null;
  isAnonymous: boolean;
  type: IncidentType;
  description: string;
  location: { lat: number; lng: number };
  mediaUrls: string[];
  status: IncidentStatus;
  createdAt: any;
}
